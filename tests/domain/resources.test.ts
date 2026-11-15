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
  type Result,
  type TimeTables,
} from "../../src/domain";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const dHib = asId("decision", "decision.hibernate");
const SUPPLIES = "res.endurance.supplies";
const YEAR = 365.25 * 86400;
const H = 3600;

/** TIMELINES §11 D_hib exactly: triggers when supplies reach 10, hard deadline at 5, checkpoint. */
const D_HIB: DecisionDef = {
  id: dHib,
  owner: romilly,
  triggerWhen: { resourceId: SUPPLIES, atOrBelow: 10 },
  deadlineT: null,
  deadlineWhen: { resourceId: SUPPLIES, atOrBelow: 5 },
  checkpoint: true,
  options: { hibernate: [{ kind: "SetAvailability", characterId: romilly, reason: "HIBERNATING" }], stay: [] },
};
/** TEST-ONLY placeholder fixture (TIMELINES §11): r(Miller) = 1/61 362; awake Romilly uses 1 unit per year. */
const TABLES: TimeTables = {
  rates: { [LOCATIONS.millerSurface]: 1 / 61362, [LOCATIONS.endurance]: 1 },
  decisions: { [dHib]: D_HIB },
  activities: { survey: { atomic: false } },
  resources: {
    [SUPPLIES]: { id: SUPPLIES, owner: { character: romilly }, rate: 1 / YEAR, rateWhen: { HIBERNATING: 0.1 / YEAR } },
    "res.test.fuel": { id: "res.test.fuel", owner: { location: LOCATIONS.endurance }, rate: 1, rateWhen: {} },
  },
};
const h = createHandlers(TABLES);

function start(extra: Record<string, number> = {}): GameState {
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
    resources: {
      [SUPPLIES]: { amount: 30 },
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { amount: v }])),
    },
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
const supplies = (s: GameState) => s.resources[SUPPLIES]!.amount;
const near = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const committed = (r: Result) => {
  if (r.kind !== "Ok" && r.kind !== "Interrupted") throw new Error(r.kind);
  return r;
};

describe("W1: extra time on the planet changes Romilly's state (TIMELINES §11)", () => {
  it("A1: 1 h for Cooper is 7 years and 7 units of supplies", () => {
    const out = apply(start(), survey("a1", 1 * H), h);
    near(out.state.T / YEAR, 7);
    near(out.state.characters[romilly]!.tau / YEAR, 7);
    near(supplies(out.state), 23);
    expect(committed(out.result).events.map((e) => e.kind)).toEqual([
      "ClockAdvanced",
      "ResourceChanged",
      "ActivityCompleted",
    ]);
    expect(out.state.decisions[dHib]).toBeUndefined();
  });

  it("B1: 3 h is 21 years, 9 units, and D_hib pending since 20 years with a checkpoint", () => {
    const out = apply(start(), survey("b1", 3 * H), h);
    const r = committed(out.result);
    expect(r.kind).toBe("Ok");
    near(out.state.T / YEAR, 21);
    near(supplies(out.state), 9);
    expect(out.state.decisions[dHib]).toEqual({ status: "pending", optionId: null });
    const pending = r.events.find((e) => e.kind === "DecisionPending")!;
    near(pending.T / YEAR, 20);
    near(supplies(r.checkpoints[0]!.state), 10);
  });

  it("is deterministic: the same commands give identical states", () => {
    expect(apply(start(), survey("b1", 3 * H), h).state).toEqual(apply(start(), survey("b1", 3 * H), h).state);
  });
});

describe("W3: the supplies deadline stops the survey; hibernating slows consumption", () => {
  it("interrupts at 25 years with 5 units left, then hibernation cuts the use rate", () => {
    let out = apply(start(), survey("c1", 4 * H), h);
    expect(out.result.kind).toBe("Interrupted");
    near(out.state.T / YEAR, 25);
    near(supplies(out.state), 5);
    near(out.state.characters[cooper]!.tau, 3 * H + 34 * 60 + 17, 0.5);

    let s = apply(out.state, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, h).state;
    s = apply(s, { kind: "ResolveDecision", commandId: "r1", decisionId: dHib, optionId: "hibernate" }, h).state;
    s = apply(s, { kind: "SwitchCharacter", commandId: "s2", targetId: cooper }, h).state;
    const left = 4 * H - s.characters[cooper]!.tau;
    out = apply(s, survey("c2", left), h);
    expect(out.result.kind).toBe("Ok");
    const years = (left * 61362) / YEAR;
    near(supplies(out.state), 5 - 0.1 * years, 1e-6);
  });
});

describe("depletion, refunds and forecasts (INV-10)", () => {
  it("a resource runs out at the exact moment and never goes negative", () => {
    const base = start({ "res.test.fuel": 50 });
    const s: GameState = {
      ...base,
      characters: { ...base.characters, [cooper]: { ...base.characters[cooper]!, location: LOCATIONS.endurance } },
    };
    const out = apply(s, { kind: "FreeRoamTick", commandId: "f1", actorId: cooper, dTau: 100 }, h);
    const r = committed(out.result);
    const depleted = r.events.find((e) => e.kind === "ResourceDepleted")!;
    expect(depleted).toMatchObject({ resourceId: "res.test.fuel", amount: 0, T: 50 });
    expect(out.state.resources["res.test.fuel"]).toEqual({ amount: 0 });
  });

  it("switching never refunds anything", () => {
    let s = apply(start(), survey("a1", 1 * H), h).state;
    const before = s.resources;
    for (let i = 0; i < 20; i++) {
      s = apply(s, { kind: "SwitchCharacter", commandId: `s${i}`, targetId: i % 2 ? cooper : romilly }, h).state;
    }
    expect(s.resources).toEqual(before);
  });

  it("a dead owner uses nothing", () => {
    const base = start();
    const s: GameState = {
      ...base,
      characters: { ...base.characters, [romilly]: { ...base.characters[romilly]!, unavailable: "DEAD" } },
    };
    expect(supplies(apply(s, survey("a1", 1 * H), h).state)).toBe(30);
  });

  it("forecasts the supplies-based trigger and deadline, and resolves early", () => {
    const engine = createEngine(start(), createRules(TABLES));
    const f = engine.forecast(dHib)!;
    near(f.triggerT! / YEAR, 20);
    near(f.deadlineT! / YEAR, 25);
    engine.dispatch({ kind: "SwitchCharacter", commandId: "s1", targetId: romilly });
    const r = engine.dispatch({ kind: "ResolveDecision", commandId: "r1", decisionId: dHib, optionId: "stay" });
    expect(committed(r).events.map((e) => e.kind)).toEqual([
      "DecisionPending",
      "CheckpointCreated",
      "DecisionResolved",
    ]);
    expect(engine.forecast(dHib)).toBeNull();
  });
});
