import fc from "fast-check";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { LOCATIONS } from "../../src/content";
import {
  apply,
  asId,
  createHandlers,
  SCHEMA_VERSION,
  type Command,
  type DecisionDef,
  type GameState,
  type HandlerMap,
  type Result,
  type TimeTables,
} from "../../src/domain";
import {
  canonicalJson,
  decodeSave,
  encodeSave,
  IndexedDbBackend,
  MAX_CHECKPOINTS,
  MemoryBackend,
  SaveSlots,
  stateHash,
  type SaveBackend,
} from "../../src/persistence";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const dHib = asId("decision", "decision.hibernate");
const SUPPLIES = "res.endurance.supplies";
const YEAR = 365.25 * 86400;
const H = 3600;
const CONTENT = "test-content-1";
const OPTS = { contentVersion: CONTENT };
const SAVED_AT = "2026-11-15T10:00:00.000Z";

const D_HIB: DecisionDef = {
  id: dHib,
  owner: romilly,
  triggerWhen: { resourceId: SUPPLIES, atOrBelow: 10 },
  deadlineT: null,
  deadlineWhen: { resourceId: SUPPLIES, atOrBelow: 5 },
  checkpoint: true,
  options: { hibernate: [{ kind: "SetAvailability", characterId: romilly, reason: "HIBERNATING" }], stay: [] },
};
/** TEST-ONLY placeholder fixture (TIMELINES §11). */
const TABLES: TimeTables = {
  rates: { [LOCATIONS.millerSurface]: 1 / 61362, [LOCATIONS.endurance]: 1 },
  decisions: { [dHib]: D_HIB },
  resources: {
    [SUPPLIES]: { id: SUPPLIES, owner: { character: romilly }, rate: 1 / YEAR, rateWhen: { HIBERNATING: 0.1 / YEAR } },
  },
};
const h: HandlerMap = createHandlers(TABLES);

function start(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT,
    T: 0,
    seq: 0,
    controlled: cooper,
    characters: {
      [cooper]: { id: cooper, tau: 0, location: LOCATIONS.millerSurface, unavailable: null },
      [romilly]: { id: romilly, tau: 0, location: LOCATIONS.endurance, unavailable: null },
    },
    resources: { [SUPPLIES]: { amount: 30 } },
    decisions: {},
    knowledge: {},
    playerSeen: [],
    messages: [],
    activities: {},
    processedCommandIds: [],
    rng: { seed: 42, state: 42 },
  };
}

const survey = (commandId: string, dTau: number): Command => ({
  kind: "AdvanceTime",
  commandId,
  actorId: cooper,
  activityId: "survey",
  dTau,
});
const switchTo = (commandId: string, targetId: typeof cooper): Command => ({
  kind: "SwitchCharacter",
  commandId,
  targetId,
});
const resolve = (commandId: string, optionId: string): Command => ({
  kind: "ResolveDecision",
  commandId,
  decisionId: dHib,
  optionId,
});
/** W1 B1: 3 h on the surface; D_hib pending with its checkpoint. */
function atB1(): { state: GameState; result: Result } {
  return apply(start(), survey("b1", 3 * H), h);
}

describe("save round trip (INV-14)", () => {
  it("decodes to an equal state with an identical hash", async () => {
    const { state, result } = atB1();
    const text = await encodeSave(state, result.kind === "Ok" ? result.events : [], SAVED_AT);
    const out = await decodeSave(text, OPTS);
    if (!out.ok) throw new Error(`${out.code}: ${out.detail}`);
    expect(out.save.state).toEqual(state);
    expect(await stateHash(out.save.state)).toBe(await stateHash(state));
    expect(Object.isFrozen(out.save.state)).toBe(true);
    expect(out.save.eventTail.length).toBeGreaterThan(0);
  });

  it("keeps only the last 200 events", async () => {
    const events = Array.from({ length: 250 }, (_, i) => ({ kind: "ClockAdvanced" as const, T: i, dT: 1, seq: i + 1 }));
    const out = await decodeSave(await encodeSave(start(), events, SAVED_AT), OPTS);
    expect(out.ok && out.save.eventTail.length).toBe(200);
    expect(out.ok && out.save.eventTail[0]).toMatchObject({ seq: 51 });
  });

  it("any sequence of commands survives save and reload, and continues identically (property)", async () => {
    const cmd = fc.oneof(
      fc.integer({ min: 1, max: 4 * H }).map((d) => ({ k: "adv" as const, d })),
      fc.constantFrom(cooper, romilly).map((t) => ({ k: "sw" as const, t })),
      fc.constantFrom("hibernate", "stay").map((o) => ({ k: "res" as const, o })),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(cmd, { maxLength: 12 }), fc.array(cmd, { maxLength: 4 }), async (before, after) => {
        const toCommand = (c: (typeof before)[number], i: string): Command =>
          c.k === "adv" ? survey(i, c.d) : c.k === "sw" ? switchTo(i, c.t) : resolve(i, c.o);
        let s = start();
        before.forEach((c, i) => (s = apply(s, toCommand(c, `b${i}`), h).state));
        const out = await decodeSave(await encodeSave(s, [], SAVED_AT), OPTS);
        if (!out.ok) throw new Error(out.code);
        let a = s;
        let b = out.save.state;
        after.forEach((c, i) => {
          const ra = apply(a, toCommand(c, `a${i}`), h);
          const rb = apply(b, toCommand(c, `a${i}`), h);
          expect(rb.result).toEqual(ra.result);
          a = ra.state;
          b = rb.state;
        });
        expect(canonicalJson(b)).toBe(canonicalJson(a));
      }),
      { seed: 20261115, numRuns: 60 },
    );
  });
});

describe("W4: save and reload at a pending decision", () => {
  it("resolves once, rejects a second choice, and a checkpoint brings the decision back", async () => {
    const backend = new MemoryBackend();
    const slots = new SaveSlots(backend, OPTS);
    const b1 = atB1();
    if (b1.result.kind !== "Ok") throw new Error(b1.result.kind);
    expect(b1.result.checkpoints).toHaveLength(1);
    await slots.addCheckpoint(b1.result.checkpoints[0]!, SAVED_AT);
    await slots.writeAutosave(b1.state, b1.result.events, SAVED_AT);

    // Reload the page: same state, D_hib still pending.
    const loaded = await slots.loadAutosave();
    if (!loaded.ok) throw new Error(loaded.code);
    let s = loaded.save.state;
    expect(await stateHash(s)).toBe(await stateHash(b1.state));
    expect(s.decisions[dHib]?.status).toBe("pending");

    s = apply(s, switchTo("s1", romilly), h).state;
    const once = apply(s, resolve("cmd-77", "stay"), h);
    expect(once.result.kind).toBe("Ok");
    expect(apply(once.state, resolve("cmd-77", "stay"), h).result).toEqual({ kind: "Duplicate" });
    expect(apply(once.state, resolve("cmd-78", "hibernate"), h).result).toEqual({
      kind: "Rejected",
      code: "DECISION_ALREADY_RESOLVED",
    });

    // Loading the checkpoint is the only rewind: D_hib is pending again and can be chosen differently.
    const [cp] = await slots.listCheckpoints();
    const restored = await slots.restoreCheckpoint(cp!.key);
    if (!restored.ok) throw new Error(restored.code);
    expect(restored.save.state.decisions[dHib]?.status).toBe("pending");
    let r = apply(restored.save.state, switchTo("s2", romilly), h).state;
    r = apply(r, resolve("cmd-79", "hibernate"), h).state;
    expect(r.characters[romilly]!.unavailable).toBe("HIBERNATING");
    const autosave = await slots.loadAutosave();
    expect(autosave.ok && autosave.save.state.seq).toBe(cp!.seq);
  });

  it("drops the oldest-created checkpoint even after a rewind makes seq go back", async () => {
    const slots = new SaveSlots(new MemoryBackend(), OPTS);
    for (const seq of [10, 20, 30])
      await slots.addCheckpoint({ decisionId: dHib, state: { ...start(), seq } }, SAVED_AT);
    // Restore the seq-10 checkpoint, then play on: new checkpoints arrive with seq 15 and 16.
    await slots.addCheckpoint({ decisionId: dHib, state: { ...start(), seq: 15 } }, SAVED_AT);
    await slots.addCheckpoint({ decisionId: dHib, state: { ...start(), seq: 16 } }, SAVED_AT);
    expect((await slots.listCheckpoints()).map((c) => c.seq)).toEqual([16, 15, 30]);
  });

  it("keeps at most three checkpoints, dropping the oldest", async () => {
    const slots = new SaveSlots(new MemoryBackend(), OPTS);
    for (let seq = 1; seq <= 5; seq++) {
      await slots.addCheckpoint({ decisionId: dHib, state: { ...start(), seq } }, SAVED_AT);
    }
    const list = await slots.listCheckpoints();
    expect(list.map((c) => c.seq)).toEqual([5, 4, 3]);
    expect(list).toHaveLength(MAX_CHECKPOINTS);
  });
});

describe("corrupt and incompatible saves are refused with a code, never thrown or discarded", () => {
  const good = async () => encodeSave(atB1().state, [], SAVED_AT);
  const rehash = async (file: Record<string, unknown>) =>
    canonicalJson({ ...file, hash: await stateHash(file["state"]) });

  it.each<[string, (text: string) => Promise<string> | string, string]>([
    ["not JSON", () => "{not json", "PARSE"],
    ["truncated", (t) => t.slice(0, t.length / 2), "PARSE"],
    ["not a save", () => JSON.stringify({ hello: "world" }), "FORMAT"],
    ["edited state", (t) => t.replace('"amount":9', '"amount":99'), "HASH_MISMATCH"],
    [
      "from a newer build",
      async (t) => rehash({ ...JSON.parse(t), schemaVersion: SCHEMA_VERSION + 1 }),
      "SCHEMA_TOO_NEW",
    ],
    [
      "an envelope version that disagrees with the state",
      async (t) => rehash({ ...JSON.parse(t), state: { ...JSON.parse(t).state, schemaVersion: SCHEMA_VERSION + 1 } }),
      "FORMAT",
    ],
    ["for other content", async (t) => rehash({ ...JSON.parse(t), contentVersion: "other" }), "CONTENT_VERSION"],
    [
      "a valid hash over a broken state",
      async (t) => {
        const f = JSON.parse(t);
        return rehash({ ...f, state: { ...f.state, controlled: "char.nobody" } });
      },
      "INVALID_STATE",
    ],
  ])("%s", async (_name, mutate, code) => {
    const out = await decodeSave(await mutate(await good()), OPTS);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.code).toBe(code);
  });

  it("runs migrations in order, and reports a missing or failing one", async () => {
    const text = await good();
    const toV2 = { 1: (s: Record<string, unknown>) => ({ ...s }) };
    const migrated = await decodeSave(text, { ...OPTS, schemaVersion: 2, migrations: toV2 });
    expect(migrated.ok && migrated.save.state.schemaVersion).toBe(2);
    expect(migrated.ok && migrated.save.schemaVersion).toBe(2);
    const missing = await decodeSave(text, { ...OPTS, schemaVersion: 2, migrations: {} });
    expect(!missing.ok && missing.code).toBe("MIGRATION_MISSING");
    const boom = await decodeSave(text, {
      ...OPTS,
      schemaVersion: 2,
      migrations: {
        1: () => {
          throw new Error("boom");
        },
      },
    });
    expect(!boom.ok && boom.code).toBe("MIGRATION_FAILED");
  });

  it("fuzzed corruption never throws, and anything accepted is the original state", async () => {
    const text = await good();
    const original = canonicalJson(atB1().state);
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: text.length - 1 }),
        fc.oneof(fc.constant("cut"), fc.string({ minLength: 1, maxLength: 3 })),
        async (at, change) => {
          const mutated = change === "cut" ? text.slice(0, at) : text.slice(0, at) + change + text.slice(at + 1);
          const out = await decodeSave(mutated, OPTS);
          if (out.ok) expect(canonicalJson(out.save.state)).toBe(original);
        },
      ),
      { seed: 7, numRuns: 400 },
    );
  });

  it("a corrupt autosave moves to quarantine, stays exportable, and the slot is cleared", async () => {
    const backend = new MemoryBackend();
    const slots = new SaveSlots(backend, OPTS);
    await backend.put("autosave", "{corrupt");
    const out = await slots.loadAutosave();
    expect(out).toMatchObject({ ok: false, code: "PARSE" });
    const key = !out.ok && "quarantinedAs" in out ? out.quarantinedAs : "";
    expect(await slots.exportSlot(key)).toBe("{corrupt");
    expect(await slots.loadAutosave()).toEqual({ ok: false, code: "EMPTY" });
    expect((await slots.listQuarantine()).map((q) => [q.from, q.code])).toEqual([["autosave", "PARSE"]]);
  });

  it("overlapping bad imports each keep their own quarantine entry", async () => {
    const slots = new SaveSlots(new MemoryBackend(), OPTS);
    const [a, b] = await Promise.all([slots.importSave("bad1"), slots.importSave("bad2")]);
    const keyA = !a.ok && "quarantinedAs" in a ? a.quarantinedAs : "";
    const keyB = !b.ok && "quarantinedAs" in b ? b.quarantinedAs : "";
    expect(keyA).not.toBe(keyB);
    expect(await slots.exportSlot(keyA)).toBe("bad1");
    expect(await slots.exportSlot(keyB)).toBe("bad2");
  });

  it("a bad import is quarantined and leaves the current autosave untouched; a good one replaces it", async () => {
    const slots = new SaveSlots(new MemoryBackend(), OPTS);
    await slots.writeAutosave(start(), [], SAVED_AT);
    const bad = await slots.importSave("nope");
    expect(bad).toMatchObject({ ok: false, code: "PARSE" });
    const kept = await slots.loadAutosave();
    expect(kept.ok && kept.save.state.T).toBe(0);
    const imported = await slots.importSave(await good());
    expect(imported.ok).toBe(true);
    const now = await slots.loadAutosave();
    expect(now.ok && now.save.state.T).toBeGreaterThan(0);
    expect(await slots.listQuarantine()).toHaveLength(1);
  });
});

describe("IndexedDB backend", () => {
  it("stores, lists and deletes saves", async () => {
    const backend: SaveBackend = new IndexedDbBackend("irpg-test", new IDBFactory());
    await backend.put("autosave", "a");
    await backend.put("checkpoint/1", "b");
    expect(await backend.get("autosave")).toBe("a");
    expect((await backend.keys()).sort()).toEqual(["autosave", "checkpoint/1"]);
    await backend.delete("autosave");
    expect(await backend.get("autosave")).toBeUndefined();
    const slots = new SaveSlots(backend, OPTS);
    await slots.writeAutosave(start(), [], SAVED_AT);
    const out = await slots.loadAutosave();
    expect(out.ok && out.save.state).toEqual(start());
  });
});
