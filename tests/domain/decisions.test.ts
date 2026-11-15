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
    activities: {},
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
    expect(s.activities[cooper]).toMatchObject({ activityId: "survey", actorId: cooper });
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
    expect(rest.state.activities).toEqual({});
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

describe("activity progress across interruptions and checkpoints (TIMELINES §3, §8)", () => {
  const first = asId("decision", "decision.first");
  const second = asId("decision", "decision.second");
  const hard = (id: typeof first, triggerT: number, deadlineT: number, checkpoint = false): DecisionDef => ({
    id,
    owner: cooper,
    triggerT,
    deadlineT,
    checkpoint,
    options: { go: [] },
  });
  // Cooper on Endurance (rate 1) so Δτ and T line up: a 100 s survey, deadlines at 80 s and 85 s.
  const onShip = (): GameState => {
    const s = start();
    return {
      ...s,
      characters: { ...s.characters, [cooper]: { ...s.characters[cooper]!, location: LOCATIONS.endurance } },
    };
  };

  it("keeps cumulative progress when a resumed activity is interrupted again", () => {
    const h = createHandlers({ ...tables(false, [hard(first, 10, 80), hard(second, 82, 85)]) });
    let s = apply(onShip(), survey("c1", 100), h).state;
    expect(s.activities[cooper]?.progress).toBeCloseTo(0.8, 12);
    s = apply(s, resolve("r1", first, "go"), h).state;
    const again = apply(s, survey("c2", 20), h);
    expect(again.result.kind).toBe("Interrupted");
    expect(again.state.activities[cooper]?.progress).toBeCloseTo(0.85, 12);
    const done = apply(apply(again.state, resolve("r2", second, "go"), h).state, survey("c3", 15), h);
    expect(done.state.activities).toEqual({});
  });

  it("records the activity's progress in a checkpoint taken part-way through", () => {
    const h = createHandlers({ ...tables(false, [{ ...hard(first, 70, 1000, true), deadlineT: null }]) });
    const out = apply(onShip(), survey("c1", 100), h);
    const r = committed(out.result);
    expect(r.checkpoints[0]!.state.activities[cooper]).toEqual({
      activityId: "survey",
      actorId: cooper,
      progress: 0.7,
    });
    expect(out.state.activities).toEqual({});
  });

  it("keeps each character's interrupted work when another character's activity is interrupted", () => {
    const dRom = asId("decision", "decision.romilly_deadline");
    const h = createHandlers({
      ...tables(false, [hard(first, 10, 80), { ...hard(dRom, 85, 85), owner: romilly }]),
    });
    let s = apply(onShip(), survey("c1", 100), h).state; // Cooper's survey stops at 80%
    s = apply(s, resolve("r1", first, "go"), h).state;
    s = apply(s, switchTo("s1", romilly), h).state;
    const repair = apply(
      s,
      { kind: "AdvanceTime", commandId: "c2", actorId: romilly, activityId: "repair", dTau: 10 },
      h,
    );
    expect(repair.result.kind).toBe("Interrupted");
    expect(repair.state.activities[romilly]).toMatchObject({ activityId: "repair", progress: 0.5 });
    expect(repair.state.activities[cooper]).toMatchObject({ activityId: "survey", progress: 0.8 });
  });

  it("does not drop an unrelated interrupted activity when another one completes", () => {
    const h = createHandlers(tables(false, []));
    const s: GameState = {
      ...onShip(),
      activities: { [cooper]: { activityId: "repair", actorId: cooper, progress: 0.5 } },
    };
    expect(apply(s, survey("c1", 10), h).state.activities).toEqual(s.activities);
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
    for (const inherited of ["toString", "constructor", "__proto__"]) {
      expect(apply(s, resolve(`ry-${inherited}`, dSoft, inherited), h).result).toMatchObject({
        kind: "Rejected",
        code: "INVALID",
      });
    }
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

describe("a choice that costs its owner time (SpendTime)", () => {
  const dWave = asId("decision", "decision.wave");
  const dLater = asId("decision", "decision.later");
  const doyle = asId("char", "char.doyle");
  const WAVE: DecisionDef = {
    id: dWave,
    owner: cooper,
    triggerT: 1 * YEAR,
    deadlineT: 2 * YEAR,
    checkpoint: true,
    options: {
      leave: [],
      stay: [
        { kind: "SetAvailability", characterId: doyle, reason: "DEAD", cause: "wave" },
        { kind: "SpendTime", characterId: cooper, dTau: H },
      ],
    },
  };
  const LATER: DecisionDef = { ...D_SOFT, id: dLater, triggerT: 3 * YEAR };
  const withDoyle = (): GameState => {
    const s = start();
    return {
      ...s,
      characters: {
        ...s.characters,
        [doyle]: { id: doyle, tau: 0, location: LOCATIONS.millerSurface, unavailable: null },
      },
    };
  };
  const h = createHandlers(tables(false, [WAVE, LATER]));

  it("moves the clocks for everyone and records why a character died", () => {
    const base = apply(withDoyle(), resolve("r0", dWave, "stay"), h);
    const r = committed(base.result);
    expect(r.kind).toBe("Ok");
    // One hour of Cooper's time on Miller is 61 362 hours of reference time, so Romilly waits 7 years.
    near(base.state.T, H * 61362, 1);
    near(base.state.characters[cooper]!.tau, H, 1e-6);
    near(base.state.characters[romilly]!.tau, H * 61362, 1);
    expect(base.state.characters[doyle]).toMatchObject({ unavailable: "DEAD", cause: "wave" });
    // Later decisions that fall inside the hour trigger on the way, in the same commit.
    expect(base.state.decisions[dLater]?.status).toBe("pending");
    const kinds = r.events.map((e) => e.kind);
    expect(kinds.indexOf("DecisionResolved")).toBeLessThan(kinds.indexOf("ClockAdvanced"));
  });

  it("costs nothing when the other option is chosen", () => {
    const out = apply(withDoyle(), resolve("r0", dWave, "leave"), h);
    expect(out.state.T).toBe(0);
    expect(out.state.characters[doyle]).toMatchObject({ unavailable: null });
  });

  it("never stops half-way: a hard deadline inside the spend blocks the whole choice, and the cost is paid in full later", () => {
    const wall: DecisionDef = { ...D_HIB, id: dHib, owner: cooper, triggerT: 2.5 * YEAR, deadlineT: 3 * YEAR };
    const hh = createHandlers(tables(false, [WAVE, wall]));
    const s0 = withDoyle();
    const blocked = apply(s0, resolve("r0", dWave, "stay"), hh);
    // Nothing commits: no death, no rewards, no recorded choice, no time passed (INV-05).
    expect(blocked.result).toEqual({ kind: "Blocked", decisionId: dHib, deadlineT: 3 * YEAR });
    expect(blocked.state).toBe(s0);
    // Resolve the blocker early (a hard decision may be), then the choice goes through and costs the full hour.
    const early = apply(blocked.state, resolve("r1", dHib, "stay"), hh);
    expect(committed(early.result).kind).toBe("Ok");
    const done = apply(early.state, resolve("r2", dWave, "stay"), hh);
    expect(committed(done.result).kind).toBe("Ok");
    near(done.state.characters[cooper]!.tau, H, 1e-6);
    expect(done.state.characters[doyle]).toMatchObject({ unavailable: "DEAD" });
  });

  it("takes no checkpoint for a decision that opens inside the spend, so no restore can skip the cost", () => {
    // A checkpointed decision triggers 30 s into a 3600 s spend (Cooper's time; 30 s there is 30 x 61 362 s of T).
    const early: DecisionDef = { ...D_HIB, id: dHib, owner: cooper, triggerT: 30 * 61362, deadlineT: null };
    const hh = createHandlers(tables(false, [WAVE, early]));
    const out = apply(withDoyle(), resolve("r0", dWave, "stay"), hh);
    const r = committed(out.result);
    // The wave's own checkpoint (taken before the choice, at its early resolution) is kept; none is taken for the other.
    expect(r.checkpoints.map((c) => c.decisionId)).toEqual([dWave]);
    expect(r.events.filter((e) => e.kind === "CheckpointCreated")).toHaveLength(1);
    expect(out.state.decisions[dHib]?.status).toBe("pending");
    near(out.state.characters[cooper]!.tau, H, 1e-6); // the whole cost was paid
  });

  it("is all-or-nothing: if the time cannot pass, the choice is not recorded", () => {
    // A hard decision already held at its deadline blocks any time from passing, so the whole resolve is blocked.
    const held: DecisionDef = { ...D_HIB, id: dHib, owner: cooper, triggerT: 0, deadlineT: 0 };
    const hh = createHandlers(tables(false, [WAVE, held]));
    const s: GameState = { ...withDoyle(), decisions: { [dHib]: { status: "pending", optionId: null } } };
    const out = apply(s, resolve("r0", dWave, "stay"), hh);
    expect(out.result.kind).toBe("Blocked");
    expect(out.state).toBe(s);
  });
});
