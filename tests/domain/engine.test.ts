import { describe, expect, it } from "vitest";
import {
  apply,
  asId,
  createEngine,
  defaultHandlers,
  PROCESSED_ID_WINDOW,
  SCHEMA_VERSION,
  type Command,
  type GameState,
  type HandlerMap,
} from "../../src/domain";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const brand = asId("char", "char.brand");
const surface = asId("loc", "loc.miller.surface");
const orbit = asId("loc", "loc.endurance");
const recorder = asId("decision", "decision.recorder");

function initialState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: "test",
    T: 0,
    seq: 0,
    controlled: cooper,
    characters: {
      [cooper]: { id: cooper, tau: 0, location: surface, unavailable: null },
      [romilly]: { id: romilly, tau: 0, location: orbit, unavailable: null },
      [brand]: { id: brand, tau: 0, location: surface, unavailable: "INJURED" },
    },
    resources: {},
    decisions: {},
    knowledge: {},
    playerSeen: [],
    messages: [],
    activity: null,
    processedCommandIds: [],
    rng: { seed: 1, state: 1 },
  };
}

/** Test-only handler: advances T by dTau and emits one ClockAdvanced event, or two with a checkpoint between. */
const testHandlers: HandlerMap = {
  ...defaultHandlers,
  FreeRoamTick(state, command) {
    if (command.dTau < 0) return { kind: "rejected", code: "INVALID", detail: "negative dTau" };
    if (command.dTau > 100) return { kind: "blocked", decisionId: recorder, deadlineT: state.T + 100 };
    const T = state.T + command.dTau;
    return { kind: "commit", state: { ...state, T }, events: [{ kind: "ClockAdvanced", T, dT: command.dTau }] };
  },
  ResolveDecision(state, command) {
    const mid = {
      ...state,
      decisions: {
        ...state.decisions,
        [command.decisionId]: { status: "resolved" as const, optionId: command.optionId },
      },
    };
    return {
      kind: "commit",
      state: { ...mid, T: state.T + 1 },
      events: [
        { kind: "DecisionResolved", T: state.T, decisionId: command.decisionId, optionId: command.optionId },
        { kind: "CheckpointCreated", T: state.T, decisionId: command.decisionId },
        { kind: "ClockAdvanced", T: state.T + 1, dT: 1 },
      ],
      checkpoints: [{ decisionId: command.decisionId, state: mid, afterEvents: 2 }],
      interruptedBy: command.decisionId,
    };
  },
};

const tick = (commandId: string, dTau = 1): Command => ({ kind: "FreeRoamTick", commandId, actorId: cooper, dTau });

describe("apply", () => {
  it("commits events with increasing seq and records the command id", () => {
    const a = apply(initialState(), tick("c1"), testHandlers);
    const b = apply(a.state, tick("c2", 2), testHandlers);
    expect(b.state.T).toBe(3);
    expect(b.state.seq).toBe(2);
    expect(b.result).toEqual({ kind: "Ok", events: [{ kind: "ClockAdvanced", T: 3, dT: 2, seq: 2 }], checkpoints: [] });
    expect(b.state.processedCommandIds).toEqual(["c1", "c2"]);
  });

  it("returns Duplicate and the identical state for a repeated command id (ADR-002)", () => {
    const once = apply(initialState(), tick("c1"), testHandlers);
    const twice = apply(once.state, tick("c1", 50), testHandlers);
    expect(twice.result).toEqual({ kind: "Duplicate" });
    expect(twice.state).toBe(once.state);
  });

  it("leaves state untouched on Rejected and Blocked (INV-04, INV-05)", () => {
    const s = apply(initialState(), tick("c1"), testHandlers).state;
    const rejected = apply(s, tick("bad", -1), testHandlers);
    expect(rejected.result).toEqual({ kind: "Rejected", code: "INVALID", detail: "negative dTau" });
    expect(rejected.state).toBe(s);
    const blocked = apply(s, tick("long", 500), testHandlers);
    expect(blocked.result).toEqual({ kind: "Blocked", decisionId: recorder, deadlineT: 101 });
    expect(blocked.state).toBe(s);
    // Neither id was recorded, so a corrected retry with the same id still runs.
    expect(apply(s, tick("bad", 1), testHandlers).result.kind).toBe("Ok");
  });

  it("rejects commands that have no handler instead of ignoring them", () => {
    const s = initialState();
    const out = apply(
      s,
      { kind: "SendMessage", commandId: "m1", fromId: cooper, toId: romilly, factIds: [] },
      testHandlers,
    );
    expect(out.result).toEqual({ kind: "Rejected", code: "INVALID", detail: "no handler for SendMessage" });
    expect(out.state).toBe(s);
  });

  it(`keeps only the last ${PROCESSED_ID_WINDOW} command ids`, () => {
    let s = initialState();
    for (let i = 0; i <= PROCESSED_ID_WINDOW; i++) s = apply(s, tick(`c${i}`, 0), testHandlers).state;
    expect(s.processedCommandIds).toHaveLength(PROCESSED_ID_WINDOW);
    expect(s.processedCommandIds[0]).toBe("c1");
    // The evicted id is no longer recognised as a duplicate.
    expect(apply(s, tick("c0", 0), testHandlers).result.kind).toBe("Ok");
    expect(apply(s, tick("c1", 0), testHandlers).result.kind).toBe("Duplicate");
  });

  it("returns deeply frozen state and events", () => {
    const { state, result } = apply(initialState(), tick("c1"), testHandlers);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.characters[cooper])).toBe(true);
    expect(() => {
      (state as { T: number }).T = 99;
    }).toThrow(TypeError);
    if (result.kind !== "Ok") throw new Error("expected Ok");
    expect(Object.isFrozen(result.events[0])).toBe(true);
  });

  it("deep-freezes state that arrives shallow-frozen", () => {
    const shallow = Object.freeze(initialState());
    const engine = createEngine(shallow, { handlers: testHandlers });
    expect(Object.isFrozen(engine.getState().characters[cooper])).toBe(true);
    expect(() => {
      (engine.getState().characters[cooper] as { tau: number }).tau = 5;
    }).toThrow(TypeError);
  });

  it("stamps checkpoint snapshots with the seq of the events before them", () => {
    const s = apply(initialState(), tick("c1"), testHandlers).state;
    const out = apply(
      s,
      { kind: "ResolveDecision", commandId: "d1", decisionId: recorder, optionId: "take" },
      testHandlers,
    );
    if (out.result.kind !== "Interrupted") throw new Error("expected Interrupted");
    expect(out.result.events.map((e) => e.seq)).toEqual([2, 3, 4]);
    expect(out.result.checkpoints).toHaveLength(1);
    const snap = out.result.checkpoints[0]!;
    expect(snap.state.seq).toBe(3);
    expect(snap.state.T).toBe(1);
    expect(Object.isFrozen(snap.state)).toBe(true);
    expect(out.state.seq).toBe(4);
  });

  it("refuses handler events that go back in time (INV-01)", () => {
    const backwards: HandlerMap = {
      FreeRoamTick: (state) => ({ kind: "commit", state, events: [{ kind: "ClockAdvanced", T: state.T - 1, dT: -1 }] }),
    };
    expect(() => apply(initialState(), tick("c1"), backwards)).toThrow(/INV-01/);
  });
});

describe("SwitchCharacter (INV-03)", () => {
  it("changes only the controlled character and records nothing", () => {
    const s = apply(initialState(), tick("c1"), testHandlers).state;
    const out = apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, testHandlers);
    expect(out.result).toEqual({ kind: "Ok", events: [], checkpoints: [] });
    expect({ ...out.state, controlled: s.controlled }).toEqual(s);
    expect(out.state.controlled).toBe(romilly);
    // Switching back with the same id works: switches are not history.
    const back = apply(out.state, { kind: "SwitchCharacter", commandId: "s1", targetId: cooper }, testHandlers);
    expect(back.state).toEqual(s);
  });

  it("denies switching away from a locked sequence (TIMELINES §4)", () => {
    const base = initialState();
    const locked: GameState = {
      ...base,
      characters: { ...base.characters, [cooper]: { ...base.characters[cooper]!, unavailable: "LOCKED_SEQUENCE" } },
    };
    const out = apply(locked, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, testHandlers);
    expect(out.result).toEqual({ kind: "Rejected", code: "LOCKED_SEQUENCE" });
    expect(out.state).toBe(locked);
  });

  it("rejects unknown and unavailable targets with a reason", () => {
    const s = initialState();
    const unknown = apply(
      s,
      { kind: "SwitchCharacter", commandId: "s1", targetId: asId("char", "char.murph") },
      testHandlers,
    );
    expect(unknown.result).toMatchObject({ kind: "Rejected", code: "INVALID" });
    const injured = apply(s, { kind: "SwitchCharacter", commandId: "s2", targetId: brand }, testHandlers);
    expect(injured.result).toEqual({ kind: "Rejected", code: "CHARACTER_UNAVAILABLE", detail: "INJURED" });
    expect(injured.state).toBe(s);
  });
});

describe("createEngine", () => {
  it("dispatches, notifies subscribers on change only, and unsubscribes", () => {
    const engine = createEngine(initialState(), { handlers: testHandlers });
    const seen: number[] = [];
    const unsubscribe = engine.subscribe((state, events) => seen.push(state.T * 10 + events.length));
    engine.dispatch(tick("c1"));
    engine.dispatch(tick("c1")); // duplicate: no notification
    engine.dispatch(tick("bad", -1)); // rejected: no notification
    unsubscribe();
    engine.dispatch(tick("c2"));
    expect(seen).toEqual([11]);
    expect(engine.getState().T).toBe(2);
    expect(Object.isFrozen(engine.getState())).toBe(true);
  });

  it("forecasts through the supplied rules and returns null without them", () => {
    const plain = createEngine(initialState(), { handlers: testHandlers });
    expect(plain.forecast(recorder)).toBeNull();
    const withForecast = createEngine(initialState(), {
      handlers: testHandlers,
      forecast: (state, decisionId) => ({ decisionId, triggerT: state.T + 30 }),
    });
    withForecast.dispatch(tick("c1"));
    expect(withForecast.forecast(recorder)).toEqual({ decisionId: recorder, triggerT: 31 });
    expect(withForecast.getState().seq).toBe(1);
  });
});
