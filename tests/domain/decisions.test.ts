import { describe, expect, it } from "vitest";
import { LOCATIONS } from "../../src/content";
import {
  apply,
  asId,
  createEngine,
  createHandlers,
  createRules,
  SCHEMA_VERSION,
  type Command,
  type DecisionDef,
  type GameState,
  type HandlerMap,
  type RateTable,
  type Result,
  type TimeTables,
} from "../../src/domain";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const dHib = asId("decision", "decision.hibernate");
const dSoft = asId("decision", "decision.share_data");
const factData = asId("fact", "fact.beacon_age");
const YEAR = 365.25 * 86400;
const H = 3600;

/** TEST-ONLY placeholder from TIMELINES §11: r(Miller) = 1/61 362. */
const PLACEHOLDER: RateTable = { [LOCATIONS.millerSurface]: 1 / 61362, [LOCATIONS.endurance]: 1 };

/** TIMELINES §11 D_hib, placed on T instead of the supplies trigger (resources are RES-001). */
const D_HIB: DecisionDef = {
  id: dHib,
  owner: romilly,
  triggerT: 20 * YEAR,
  deadlineT: 25 * YEAR,
  checkpoint: true,
  options: { hibernate: [{ kind: "SetAvailability", characterId: romilly, reason: "HIBERNATING" }], stay: [] },
};
const D_SOFT: DecisionDef = {
  id: dSoft,
  owner: cooper,
  triggerT: 1 * YEAR,
  deadlineT: null,
  checkpoint: false,
  options: { send: [{ kind: "LearnFact", characterId: romilly, factId: factData }], keep: [] },
};

function tables(atomicSurvey = false, decisions: DecisionDef[] = [D_HIB]): TimeTables {
  return {
    rates: PLACEHOLDER,
    decisions: Object.fromEntries(decisions.map((d) => [d.id, d])),
    activities: { survey: { atomic: atomicSurvey } },
  };
}

function start(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: "test",
    T: 0,
    seq: 0,
    controlled: cooper,
    characters: {
      [cooper]: { id: cooper, tau: 0, location: LOCATIONS.millerSurface, unavailable: null },
      [romilly]: { id: romilly, tau: 0, location: LOCATIONS.endurance, unavailable: null },
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
const resolve = (commandId: string, decisionId: typeof dHib, optionId: string): Command => ({
  kind: "ResolveDecision",
  commandId,
  decisionId,
  optionId,
});
const near = (actual: number, expected: number, tol: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
const committed = (r: Result) => {
  if (r.kind !== "Ok" && r.kind !== "Interrupted") throw new Error(`expected a commit, got ${r.kind}`);
  return r;
};

describe("W3, interruptible survey (INV-06)", () => {
  const h: HandlerMap = createHandlers(tables());

  it("commits up to the deadline, takes the checkpoint at the trigger, and holds T", () => {
    const out = apply(start(), survey("c1", 4 * H), h);
    const r = committed(out.result);
    expect(r.kind).toBe("Interrupted");
    expect(r.kind === "Interrupted" && r.decisionId).toBe(dHib);
    expect(r.events.map((e) => e.kind)).toEqual([
      "ClockAdvanced",
      "DecisionPending",
      "CheckpointCreated",
      "ClockAdvanced",
      "ActivityInterrupted",
    ]);
    expect(r.events.map((e) => e.T / YEAR)).toEqual([20, 20, 20, 25, 25].map((y) => expect.closeTo(y, 9)));

    // C1: 2 h 51 m 26 s of Cooper's time at the trigger; C2: 3 h 34 m 17 s at the deadline (TIMELINES W3).
    const snap = r.checkpoints[0]!;
    expect(snap.decisionId).toBe(dHib);
    expect(snap.state.decisions[dHib]).toEqual({ status: "pending", optionId: null });
    near(snap.state.characters[cooper]!.tau, 2 * H + 51 * 60 + 26, 0.5);
    expect(snap.state.seq).toBe(3);

    const s = out.state;
    expect(s.T).toBe(25 * YEAR);
    near(s.characters[cooper]!.tau, 3 * H + 34 * 60 + 17, 0.5);
    expect(s.characters[romilly]!.tau).toBe(25 * YEAR);
    const interrupted = r.events[4]!;
    expect(interrupted.kind === "ActivityInterrupted" && interrupted.progress).toBeCloseTo(0.893, 3);
    expect(s.activity).toMatchObject({ activityId: "survey", actorId: cooper });
  });

  it("refuses to move past the held deadline, then continues once Romilly hibernates", () => {
    let s = apply(start(), survey("c1", 4 * H), h).state;
    const held = apply(s, survey("c2", 60), h);
    expect(held.result).toEqual({ kind: "Blocked", decisionId: dHib, deadlineT: 25 * YEAR });
    expect(held.state).toBe(s);

    s = apply(s, switchTo("s1", romilly), h).state;
    const resolved = apply(s, resolve("r1", dHib, "hibernate"), h);
    expect(committed(resolved.result).events.map((e) => e.kind)).toEqual(["DecisionResolved", "AvailabilityChanged"]);
    s = resolved.state;
    expect(s.characters[romilly]!.unavailable).toBe("HIBERNATING");
    expect(s.T).toBe(25 * YEAR);

    s = apply(s, switchTo("s2", cooper), h).state;
    const rest = apply(s, survey("c3", 4 * H - s.characters[cooper]!.tau), h);
    expect(rest.result.kind).toBe("Ok");
    near(rest.state.characters[cooper]!.tau, 4 * H, 1e-6);
    expect(rest.state.activity).toBeNull();
  });
});

describe("W3, atomic survey (INV-05) and early resolution", () => {
  const h = createHandlers(tables(true));

  it("returns Blocked and commits nothing when the span contains the deadline", () => {
    const s = start();
    const out = apply(s, survey("c1", 4 * H), h);
    expect(out.result).toEqual({ kind: "Blocked", decisionId: dHib, deadlineT: 25 * YEAR });
    expect(out.state).toBe(s);
  });

  it("resolves the forecast decision early: Pending, then Checkpoint, then Resolved", () => {
    let s = apply(start(), switchTo("s1", romilly), h).state;
    const early = apply(s, resolve("r1", dHib, "hibernate"), h);
    const r = committed(early.result);
    expect(r.events.map((e) => e.kind)).toEqual([
      "DecisionPending",
      "CheckpointCreated",
      "DecisionResolved",
      "AvailabilityChanged",
    ]);
    expect(r.checkpoints).toHaveLength(1);
    expect(r.checkpoints[0]!.state.decisions[dHib]?.status).toBe("pending");
    expect(r.checkpoints[0]!.state.characters[romilly]!.unavailable).toBeNull();

    s = apply(early.state, switchTo("s2", cooper), h).state;
    const go = apply(s, survey("c1", 4 * H), h);
    expect(go.result.kind).toBe("Ok");
    near(go.state.T, 4 * H * 61362, 1e-3);
  });

  it("allows an atomic activity that ends exactly at the deadline", () => {
    const toDeadline = (25 * YEAR) / 61362;
    const out = apply(start(), survey("c1", toDeadline), h);
    expect(out.result.kind).toBe("Ok");
    expect(out.state.decisions[dHib]?.status).toBe("pending");
  });
});

describe("soft decisions (INV-07) and resolution rules (INV-16)", () => {
  const h = createHandlers(tables(false, [D_SOFT, D_HIB]));

  it("a soft decision lets T run on and withholds only its own effects", () => {
    const out = apply(start(), survey("c1", 1 * H), h); // 7 years: past the 1-year trigger, before D_hib
    const r = committed(out.result);
    expect(r.kind).toBe("Ok");
    expect(r.events.map((e) => e.kind)).toEqual([
      "ClockAdvanced",
      "DecisionPending",
      "ClockAdvanced",
      "ActivityCompleted",
    ]);
    expect(out.state.decisions[dSoft]).toEqual({ status: "pending", optionId: null });
    expect(out.state.knowledge[romilly]).toBeUndefined();

    const res = apply(out.state, resolve("r1", dSoft, "send"), h);
    expect(committed(res.result).events.map((e) => e.kind)).toEqual(["DecisionResolved", "FactLearned"]);
    expect(res.state.knowledge[romilly]).toEqual([factData]);
    expect(res.state.T).toBe(out.state.T);
  });

  it("resolves at most once and only by the controlled owner", () => {
    const s = apply(start(), survey("c1", 1 * H), h).state;
    expect(apply(s, resolve("r0", dHib, "stay"), h).result).toMatchObject({ kind: "Rejected", code: "NOT_CONTROLLED" });
    expect(apply(s, resolve("rx", dSoft, "nope"), h).result).toMatchObject({ kind: "Rejected", code: "INVALID" });
    const once = apply(s, resolve("r1", dSoft, "keep"), h).state;
    expect(apply(once, resolve("r1", dSoft, "send"), h).result).toEqual({ kind: "Duplicate" });
    expect(apply(once, resolve("r2", dSoft, "send"), h).result).toEqual({
      kind: "Rejected",
      code: "DECISION_ALREADY_RESOLVED",
    });
  });

  it("does not resolve a soft decision before it is pending", () => {
    expect(apply(start(), resolve("r1", dSoft, "send"), h).result).toMatchObject({ kind: "Rejected", code: "INVALID" });
  });
});

describe("forecast through the engine", () => {
  it("reports trigger and deadline while open, null once resolved", () => {
    const engine = createEngine(start(), createRules(tables(true)));
    expect(engine.forecast(dHib)).toEqual({ decisionId: dHib, triggerT: 20 * YEAR, deadlineT: 25 * YEAR });
    engine.dispatch(switchTo("s1", romilly));
    engine.dispatch(resolve("r1", dHib, "stay"));
    expect(engine.forecast(dHib)).toBeNull();
    expect(engine.forecast(asId("decision", "decision.unknown"))).toBeNull();
  });
});
