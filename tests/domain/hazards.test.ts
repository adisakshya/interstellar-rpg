import { describe, expect, it } from "vitest";
import {
  apply,
  asId,
  createHandlers,
  SCHEMA_VERSION,
  type Command,
  type DecisionDef,
  type GameState,
  type HazardDef,
  type RateTable,
  type TimeTables,
} from "../../src/domain";
import { LOCATIONS } from "../../src/content";

// WAVE-001: a consequence lands at the decision's deadline, not at the choice.
const cooper = asId("char", "char.cooper");
const doyle = asId("char", "char.doyle");
const dWave = asId("decision", "decision.wave");
const H = 3600;
const RATES: RateTable = { [LOCATIONS.millerSurface]: 1 / 61362, [LOCATIONS.endurance]: 1 };
const WAVE: DecisionDef = {
  id: dWave,
  owner: cooper,
  triggerT: 1000,
  deadlineT: 5000,
  checkpoint: false,
  options: { leave: [], stay: [] },
};
const HAZARD: HazardDef = {
  id: "hazard.wave",
  atDeadlineOf: dWave,
  whenOption: "stay",
  effects: [{ kind: "SetAvailability", characterId: doyle, reason: "DEAD", cause: "wave" }],
};
const tables = (): TimeTables => ({
  rates: RATES,
  decisions: { [dWave]: WAVE },
  hazards: [HAZARD],
  activities: { work: { atomic: false } },
});
const start = (): GameState => ({
  schemaVersion: SCHEMA_VERSION,
  contentVersion: "t",
  T: 0,
  seq: 0,
  controlled: cooper,
  characters: {
    [cooper]: { id: cooper, tau: 0, location: LOCATIONS.millerSurface, unavailable: null },
    [doyle]: { id: doyle, tau: 0, location: LOCATIONS.millerSurface, unavailable: null },
  },
  resources: {},
  decisions: {},
  knowledge: {},
  playerSeen: [],
  messages: [],
  activities: {},
  processedCommandIds: [],
  rng: { seed: 1, state: 1 },
});
const h = createHandlers(tables());
const resolve = (id: string, option: string): Command => ({
  kind: "ResolveDecision",
  commandId: id,
  decisionId: dWave,
  optionId: option,
});
const work = (id: string, dTau: number): Command => ({
  kind: "AdvanceTime",
  commandId: id,
  actorId: cooper,
  activityId: "work",
  dTau,
});
const doyleState = (s: GameState) => s.characters[doyle]!;

describe("hazards land at the deadline (WAVE-001)", () => {
  it("an early choice kills nobody until the deadline arrives", () => {
    // Resolve early: the warning has not even triggered yet (a hard decision may be resolved early).
    const early = apply(start(), resolve("r1", "stay"), h);
    expect(early.result.kind).toBe("Ok");
    expect(doyleState(early.state).unavailable).toBeNull();
    // Time passes, but stops short of the deadline (T = 5000 is 5000 / 61362 s of Cooper's time away).
    const before = apply(early.state, work("w1", 0.05), h);
    expect(before.state.T).toBeLessThan(5000);
    expect(doyleState(before.state).unavailable).toBeNull();
    // Crossing the deadline: Doyle dies exactly then.
    const across = apply(before.state, work("w2", 0.05), h);
    expect(doyleState(across.state)).toMatchObject({ unavailable: "DEAD", cause: "wave" });
    // His clock stops at the moment of the wave: the deadline, T = 5000, at Miller's rate.
    expect(doyleState(across.state).tau).toBeCloseTo(5000 / 61362, 9);
  });

  it("applies at once when the decision is held at its deadline and then resolved", () => {
    const held = apply(start(), work("w", 1), h); // runs into the deadline: Interrupted, T held at 5000
    expect(held.result.kind).toBe("Interrupted");
    expect(held.state.T).toBe(5000);
    const out = apply(held.state, resolve("r", "stay"), h);
    expect(doyleState(out.state)).toMatchObject({ unavailable: "DEAD", cause: "wave" });
  });

  it("applies exactly once, however many later advances cross the deadline's time", () => {
    const early = apply(start(), resolve("r1", "stay"), h);
    const a = apply(early.state, work("w1", 1), h);
    const dead = doyleState(a.state);
    const b = apply(a.state, work("w2", 1), h);
    expect(doyleState(b.state)).toEqual(dead);
    const events = (b.result.kind === "Ok" ? b.result.events : []).filter((e) => e.kind === "AvailabilityChanged");
    expect(events).toHaveLength(0);
  });

  it("does nothing for the other option", () => {
    const leave = apply(start(), resolve("r1", "leave"), h);
    const a = apply(leave.state, work("w1", 1), h);
    expect(doyleState(a.state).unavailable).toBeNull();
  });

  it("lands inside a choice's own time cost when that spans the deadline", () => {
    const big: DecisionDef = {
      ...WAVE,
      options: { leave: [], stay: [{ kind: "SpendTime", characterId: cooper, dTau: 1 * H }] },
    };
    const hh = createHandlers({ ...tables(), decisions: { [dWave]: big } });
    const out = apply(start(), resolve("r1", "stay"), hh);
    expect(out.result.kind).toBe("Ok");
    expect(doyleState(out.state)).toMatchObject({ unavailable: "DEAD", cause: "wave" });
    // The death is dated at the deadline, not at the end of the spend.
    expect(doyleState(out.state).tau).toBeCloseTo(5000 / 61362, 9);
    expect(out.state.T).toBeGreaterThan(5000);
  });
});
