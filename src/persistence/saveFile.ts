import { deepFreeze, SCHEMA_VERSION, type DomainEvent, type GameState } from "../domain";
import { canonicalJson, stateHash } from "./canonical";
import { gameStateSchema, saveEnvelopeSchema } from "./schema";

export const SAVE_FORMAT = "irpg-save";
export const EVENT_TAIL_LIMIT = 200;

/** The save file (ADR-003). `hash` is SHA-256 over canonical JSON of `state` as stored. */
export interface SaveFile {
  readonly format: typeof SAVE_FORMAT;
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly savedAt: string;
  readonly state: GameState;
  /** Debugging only; never needed to rebuild state (TIMELINES §8). */
  readonly eventTail: readonly DomainEvent[];
  readonly hash: string;
}

/** One pure step `schemaVersion n → n+1`. Each needs a fixture test (ADR-003). */
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;
export type Migrations = Readonly<Record<number, Migration>>;

/** Schema 1 is the first; later versions add entries here. */
export const MIGRATIONS: Migrations = {};

export type SaveErrorCode =
  | "PARSE" // not JSON
  | "FORMAT" // not an irpg-save envelope
  | "HASH_MISMATCH" // corrupted or edited
  | "SCHEMA_TOO_NEW" // written by a newer build
  | "MIGRATION_MISSING"
  | "MIGRATION_FAILED"
  | "CONTENT_VERSION" // made with different episode content
  | "INVALID_STATE"; // well-formed file whose state breaks the schema

export type DecodeResult =
  | { readonly ok: true; readonly save: SaveFile }
  | { readonly ok: false; readonly code: SaveErrorCode; readonly detail: string };

/** Build a save file. `savedAt` comes from the caller: the domain and persistence never read the clock. */
export async function encodeSave(state: GameState, events: readonly DomainEvent[], savedAt: string): Promise<string> {
  const file: SaveFile = {
    format: SAVE_FORMAT,
    schemaVersion: state.schemaVersion,
    contentVersion: state.contentVersion,
    savedAt,
    state,
    eventTail: events.slice(-EVENT_TAIL_LIMIT),
    hash: await stateHash(state),
  };
  return canonicalJson(file);
}

export interface DecodeOptions {
  readonly contentVersion: string;
  readonly schemaVersion?: number;
  readonly migrations?: Migrations;
}

const fail = (code: SaveErrorCode, detail: string): DecodeResult => ({ ok: false, code, detail });

/** Parse and verify a save. Never throws: every problem is a code the UI can show (ADR-003). */
export async function decodeSave(text: string, options: DecodeOptions): Promise<DecodeResult> {
  const target = options.schemaVersion ?? SCHEMA_VERSION;
  const migrations = options.migrations ?? MIGRATIONS;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return fail("PARSE", e instanceof Error ? e.message : "not JSON");
  }
  const envelope = saveEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return fail("FORMAT", envelope.error.issues[0]?.message ?? "bad envelope");
  const file = envelope.data;

  let hash: string;
  try {
    hash = await stateHash(file.state);
  } catch {
    return fail("HASH_MISMATCH", "state cannot be hashed");
  }
  if (hash !== file.hash) return fail("HASH_MISMATCH", "state does not match its hash");

  if (file.schemaVersion > target) return fail("SCHEMA_TOO_NEW", `schema ${file.schemaVersion} > ${target}`);
  if (typeof file.state !== "object" || file.state === null) return fail("INVALID_STATE", "state is not an object");
  let state = file.state as Record<string, unknown>;
  // The hash covers only the state, so the envelope's version must agree with it before choosing migrations.
  if (state["schemaVersion"] !== file.schemaVersion) {
    return fail("FORMAT", `envelope schema ${file.schemaVersion} ≠ state schema ${String(state["schemaVersion"])}`);
  }
  for (let v = file.schemaVersion; v < target; v++) {
    const step = migrations[v];
    if (!step) return fail("MIGRATION_MISSING", `no migration ${v} → ${v + 1}`);
    try {
      state = { ...step(state), schemaVersion: v + 1 };
    } catch (e) {
      return fail("MIGRATION_FAILED", `${v} → ${v + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (state["schemaVersion"] !== target) {
    return fail("MIGRATION_FAILED", `state is at schema ${String(state["schemaVersion"])}, expected ${target}`);
  }
  if (file.contentVersion !== options.contentVersion || state["contentVersion"] !== options.contentVersion) {
    return fail(
      "CONTENT_VERSION",
      `save is for content ${file.contentVersion}, this build has ${options.contentVersion}`,
    );
  }
  const checked = gameStateSchema.safeParse(state);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    return fail("INVALID_STATE", issue ? `${issue.path.join(".")}: ${issue.message}` : "invalid state");
  }
  const migrated = file.schemaVersion !== target;
  const save: SaveFile = {
    format: SAVE_FORMAT,
    schemaVersion: target,
    contentVersion: file.contentVersion,
    savedAt: file.savedAt,
    state: deepFreeze(checked.data as unknown as GameState),
    eventTail: file.eventTail as DomainEvent[],
    hash: migrated ? await stateHash(checked.data) : file.hash,
  };
  return { ok: true, save };
}
