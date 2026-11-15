import type { CheckpointSnapshot, DomainEvent, GameState } from "../domain";
import { decodeSave, encodeSave, type DecodeOptions, type SaveErrorCode, type SaveFile } from "./saveFile";

/** A string key-value store. IndexedDB in the browser, memory in tests. */
export interface SaveBackend {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export const MAX_CHECKPOINTS = 3; // D-08

export const AUTOSAVE = "autosave";
const CHECKPOINT = "checkpoint/";
const QUARANTINE = "quarantine/";

export interface QuarantineEntry {
  readonly key: string;
  readonly from: string;
  readonly code: SaveErrorCode;
  readonly detail: string;
  /** The untouched original text, so the player can still export it (ADR-003). */
  readonly raw: string;
}

export type LoadResult =
  | { readonly ok: true; readonly save: SaveFile }
  | { readonly ok: false; readonly code: "EMPTY" }
  | { readonly ok: false; readonly code: SaveErrorCode; readonly detail: string; readonly quarantinedAs: string };

export interface CheckpointInfo {
  readonly key: string;
  readonly seq: number;
  readonly decisionId: string;
}

/**
 * Autosave, up to three automatic checkpoints (oldest dropped first) and a quarantine for bad saves (D-08,
 * ADR-003, TIMELINES §8). A save that fails to load is moved to quarantine, never deleted.
 */
export class SaveSlots {
  /** Operations run one at a time, so key allocation and ring-buffer pruning never interleave. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly backend: SaveBackend,
    private readonly options: DecodeOptions,
  ) {}

  private serial<T>(op: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(op, op);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  writeAutosave(state: GameState, events: readonly DomainEvent[], savedAt: string): Promise<void> {
    return this.serial(async () => this.backend.put(AUTOSAVE, await encodeSave(state, events, savedAt)));
  }

  loadAutosave(): Promise<LoadResult> {
    return this.serial(() => this.load(AUTOSAVE));
  }

  /**
   * Store a checkpoint from `result.checkpoints`; a fourth one drops the oldest. Order is creation order, not the
   * domain `seq`, which restarts from an earlier value after a checkpoint is restored.
   */
  addCheckpoint(snapshot: CheckpointSnapshot, savedAt: string): Promise<string> {
    return this.serial(async () => {
      const existing = await this.checkpointKeys();
      const created =
        existing.reduce((max, k) => (parseCheckpoint(k).created > max ? parseCheckpoint(k).created : max), 0) + 1;
      const key = `${CHECKPOINT}${pad(created, 12)}.${pad(snapshot.state.seq, 12)}.${snapshot.decisionId}`;
      await this.backend.put(key, await encodeSave(snapshot.state, [], savedAt));
      const all = [...existing, key].sort();
      for (const old of all.slice(0, Math.max(0, all.length - MAX_CHECKPOINTS))) await this.backend.delete(old);
      return key;
    });
  }

  /** Checkpoints, most recently created first. */
  listCheckpoints(): Promise<CheckpointInfo[]> {
    return this.serial(async () => {
      const keys = (await this.checkpointKeys()).sort().reverse();
      return keys.map((key) => {
        const { seq, decisionId } = parseCheckpoint(key);
        return { key, seq, decisionId };
      });
    });
  }

  /**
   * Load a checkpoint to replace the autosave (TIMELINES §8: the only rewind; the UI asks first). The caller then
   * builds a fresh engine from the returned state.
   */
  restoreCheckpoint(key: string): Promise<LoadResult> {
    return this.serial(async () => {
      const out = await this.load(key);
      if (out.ok) {
        const text = await this.backend.get(key);
        if (text !== undefined) await this.backend.put(AUTOSAVE, text);
      }
      return out;
    });
  }

  /** Raw text of any slot, including quarantined ones, for "Export save". */
  exportSlot(key: string): Promise<string | undefined> {
    return this.serial(async () => {
      if (key.startsWith(QUARANTINE)) {
        const entry = await this.backend.get(key);
        return entry === undefined ? undefined : (JSON.parse(entry) as QuarantineEntry).raw;
      }
      return this.backend.get(key);
    });
  }

  /** Import a file as the autosave. A bad file goes to quarantine and the current autosave is left alone. */
  importSave(text: string): Promise<LoadResult> {
    return this.serial(async () => {
      const decoded = await decodeSave(text, this.options);
      if (!decoded.ok) {
        const quarantinedAs = await this.quarantine("import", text, decoded.code, decoded.detail);
        return { ok: false, code: decoded.code, detail: decoded.detail, quarantinedAs };
      }
      await this.backend.put(AUTOSAVE, text);
      return decoded;
    });
  }

  listQuarantine(): Promise<QuarantineEntry[]> {
    return this.serial(async () => {
      const keys = (await this.backend.keys()).filter((k) => k.startsWith(QUARANTINE)).sort();
      const out: QuarantineEntry[] = [];
      for (const key of keys) {
        const entry = await this.backend.get(key);
        if (entry !== undefined) out.push(JSON.parse(entry) as QuarantineEntry);
      }
      return out;
    });
  }

  private async checkpointKeys(): Promise<string[]> {
    return (await this.backend.keys()).filter((k) => k.startsWith(CHECKPOINT));
  }

  private async load(key: string): Promise<LoadResult> {
    const text = await this.backend.get(key);
    if (text === undefined) return { ok: false, code: "EMPTY" };
    const decoded = await decodeSave(text, this.options);
    if (decoded.ok) return decoded;
    // Move, never discard: copy into quarantine first, then clear the slot so the game can start fresh.
    const quarantinedAs = await this.quarantine(key, text, decoded.code, decoded.detail);
    await this.backend.delete(key);
    return { ok: false, code: decoded.code, detail: decoded.detail, quarantinedAs };
  }

  private async quarantine(from: string, raw: string, code: SaveErrorCode, detail: string): Promise<string> {
    const used = (await this.backend.keys())
      .filter((k) => k.startsWith(QUARANTINE))
      .map((k) => Number(k.slice(QUARANTINE.length).split("-")[0]));
    const next = used.reduce((a, b) => (b > a ? b : a), -1) + 1;
    // The random suffix keeps keys unique even if another tab quarantines at the same moment.
    const key = `${QUARANTINE}${pad(next, 6)}-${crypto.randomUUID()}`;
    const entry: QuarantineEntry = { key, from, code, detail, raw };
    await this.backend.put(key, JSON.stringify(entry));
    return key;
  }
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function parseCheckpoint(key: string): { created: number; seq: number; decisionId: string } {
  const [created, seq, ...rest] = key.slice(CHECKPOINT.length).split(".");
  return { created: Number(created), seq: Number(seq), decisionId: rest.join(".") };
}

/** In-memory backend for tests and for browsers without IndexedDB (nothing survives a reload). */
export class MemoryBackend implements SaveBackend {
  readonly #data = new Map<string, string>();
  async get(key: string) {
    return this.#data.get(key);
  }
  async put(key: string, value: string) {
    this.#data.set(key, value);
  }
  async delete(key: string) {
    this.#data.delete(key);
  }
  async keys() {
    return [...this.#data.keys()];
  }
}

/** IndexedDB backend: one database with a single key-value object store. */
export class IndexedDbBackend implements SaveBackend {
  static readonly STORE = "saves";
  #db: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly name = "interstellar-rpg",
    private readonly factory: IDBFactory = indexedDB,
  ) {}

  private db(): Promise<IDBDatabase> {
    this.#db ??= new Promise((resolve, reject) => {
      const req = this.factory.open(this.name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IndexedDbBackend.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    });
    return this.#db;
  }

  private async run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IndexedDbBackend.STORE, mode);
      const req = op(tx.objectStore(IndexedDbBackend.STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  }

  async get(key: string) {
    const v = await this.run("readonly", (s) => s.get(key));
    return typeof v === "string" ? v : undefined;
  }
  async put(key: string, value: string) {
    await this.run("readwrite", (s) => s.put(value, key));
  }
  async delete(key: string) {
    await this.run("readwrite", (s) => s.delete(key));
  }
  async keys() {
    const ks = await this.run("readonly", (s) => s.getAllKeys());
    return ks.map(String);
  }
}
