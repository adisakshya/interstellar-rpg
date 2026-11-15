import { describe, expect, it } from "vitest";
import { LOCATION_RATES, LOCATIONS } from "../../src/content";
import {
  apply,
  asId,
  createClockHandlers,
  createHandlers,
  SCHEMA_VERSION,
  type Command,
  type GameState,
  type HandlerMap,
  type RateTable,
} from "../../src/domain";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const murph = asId("char", "char.murph");
const brand = asId("char", "char.brand");
const slow = asId("loc", "loc.test.slow");
const YEAR = 365.25 * 86400;

/** TEST-ONLY synthetic rates (TIME-001 acceptance): 10x slower than Endurance. Not physics. */
const SYNTHETIC_10X: RateTable = { [slow]: 0.1, [LOCATIONS.endurance]: 1 };
/** TEST-ONLY placeholder from TIMELINES §11: r(Miller) = 1/61 362, so 1 h there is exactly 7 years. */
const PLACEHOLDER: RateTable = { [LOCATIONS.millerSurface]: 1 / 61362, [LOCATIONS.endurance]: 1 };

function state(cooperAt = slow): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: "test",
    T: 0,
    seq: 0,
    controlled: cooper,
    characters: {
      [cooper]: { id: cooper, tau: 0, location: cooperAt, unavailable: null },
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

const advance = (commandId: string, dTau: number, actorId = cooper): Command => ({
  kind: "AdvanceTime",
  commandId,
  actorId,
  activityId: "scan",
  dTau,
});
const tauOf = (s: GameState, id: typeof cooper) => s.characters[id]!.tau;
const closeRel = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-6, Math.abs(expected) * 1e-12));

describe("TIME-001 acceptance (synthetic 10x, test-only)", () => {
  const handlers: HandlerMap = createHandlers({ rates: SYNTHETIC_10X });

  it("advancing Cooper 60 s advances Romilly and the reference clock 600 s", () => {
    const { state: s, result } = apply(state(), advance("a1", 60), handlers);
    expect(tauOf(s, cooper)).toBe(60);
    expect(tauOf(s, romilly)).toBe(600);
    expect(s.T).toBe(600);
    expect(result).toEqual({
      kind: "Ok",
      events: [
        { kind: "ClockAdvanced", T: 600, dT: 600, seq: 1 },
        { kind: "ActivityCompleted", T: 600, activityId: "scan", progress: 1, seq: 2 },
      ],
      checkpoints: [],
    });
  });

  it("does not double-advance on a duplicate command id", () => {
    const once = apply(state(), advance("a1", 60), handlers).state;
    const twice = apply(once, advance("a1", 60), handlers);
    expect(twice.result).toEqual({ kind: "Duplicate" });
    expect(twice.state.T).toBe(600);
  });

  it("switching changes the controlled character only; the clocks stay put", () => {
    const s = apply(state(), advance("a1", 60), handlers).state;
    const switched = apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, handlers).state;
    expect(switched.controlled).toBe(romilly);
    expect(switched.T).toBe(s.T);
    expect(switched.characters).toEqual(s.characters);
    // Romilly now drives T at rate 1: 60 s of his time is 6 s for Cooper.
    const after = apply(switched, advance("a2", 60, romilly), handlers).state;
    expect(after.T).toBe(660);
    expect(tauOf(after, cooper)).toBe(66);
    expect(tauOf(after, romilly)).toBe(660);
  });

  it("free-roam ticks advance the same way with only a ClockAdvanced event", () => {
    const out = apply(state(), { kind: "FreeRoamTick", commandId: "f1", actorId: cooper, dTau: 1 }, handlers);
    expect(out.state.T).toBe(10);
    expect(out.result).toEqual({
      kind: "Ok",
      events: [{ kind: "ClockAdvanced", T: 10, dT: 10, seq: 1 }],
      checkpoints: [],
    });
  });
});

describe("rejections commit nothing (INV-05)", () => {
  const handlers = createClockHandlers({ rates: SYNTHETIC_10X });
  const cases: [string, GameState, Command, string][] = [
    ["actor not controlled", state(), advance("r1", 60, romilly), "NOT_CONTROLLED"],
    ["zero dTau", state(), advance("r2", 0), "INVALID"],
    ["negative dTau", state(), advance("r3", -5), "INVALID"],
    ["NaN dTau", state(), advance("r4", Number.NaN), "INVALID"],
    ["infinite dTau", state(), advance("r5", Number.POSITIVE_INFINITY), "INVALID"],
    ["unknown actor", state(), advance("r6", 1, brand), "INVALID"],
    ["actor location without a rate", state(asId("loc", "loc.nowhere")), advance("r7", 1), "INVALID"],
  ];
  it.each(cases)("%s", (_name, s, command, code) => {
    const out = apply(s, command, handlers);
    expect(out.result).toMatchObject({ kind: "Rejected", code });
    expect(out.state).toBe(s);
  });

  it("rejects when any character stands somewhere without a rate", () => {
    const base = state();
    const s: GameState = {
      ...base,
      characters: {
        ...base.characters,
        [murph]: { id: murph, tau: 0, location: LOCATIONS.earthFarm, unavailable: "NOT_INTRODUCED" },
      },
    };
    const out = apply(s, advance("r8", 1), handlers);
    expect(out.result).toEqual({ kind: "Rejected", code: "INVALID", detail: "no rate for loc.earth_farm" });
    expect(out.state).toBe(s);
  });

  it("lets a controlled actor in a locked sequence keep spending time", () => {
    const base = state();
    const s: GameState = {
      ...base,
      characters: { ...base.characters, [cooper]: { ...base.characters[cooper]!, unavailable: "LOCKED_SEQUENCE" } },
    };
    const out = apply(s, advance("l1", 60), createHandlers({ rates: SYNTHETIC_10X }));
    expect(out.result.kind).toBe("Ok");
    expect(out.state.T).toBe(600);
    const away = apply(
      out.state,
      { kind: "SwitchCharacter", commandId: "l2", targetId: romilly },
      createHandlers({ rates: SYNTHETIC_10X }),
    );
    expect(away.result).toEqual({ kind: "Rejected", code: "LOCKED_SEQUENCE" });
  });

  it("rejects an unavailable actor with its reason", () => {
    const base = state();
    const s: GameState = {
      ...base,
      characters: { ...base.characters, [cooper]: { ...base.characters[cooper]!, unavailable: "INJURED" } },
    };
    expect(apply(s, advance("r9", 1), handlers).result).toEqual({
      kind: "Rejected",
      code: "CHARACTER_UNAVAILABLE",
      detail: "INJURED",
    });
  });
});

describe("TIMELINES W1 with the placeholder ratio (independent expected values)", () => {
  const handlers = createClockHandlers({ rates: PLACEHOLDER });
  it("1 h for Cooper is 7.0 years for Romilly; 3 h is 21.0 years", () => {
    const a1 = apply(state(LOCATIONS.millerSurface), advance("a1", 3600), handlers).state;
    closeRel(a1.T, 7 * YEAR);
    closeRel(tauOf(a1, romilly), 7 * YEAR);
    const b1 = apply(state(LOCATIONS.millerSurface), advance("b1", 3 * 3600), handlers).state;
    closeRel(tauOf(b1, romilly), 21 * YEAR);
    expect(tauOf(b1, cooper)).toBe(3 * 3600);
  });
});

describe("physics fixture rates (PHYSICS §4)", () => {
  const handlers = createClockHandlers({ rates: LOCATION_RATES });

  it("1 h on Miller's surface is 6.894409814750342 Endurance years", () => {
    // Expected value computed by kerr_fixtures.py in 60-digit arithmetic, not by this code path.
    const s = apply(state(LOCATIONS.millerSurface), advance("m1", 3600), handlers).state;
    closeRel(s.T / YEAR, 6.894409814750342);
  });

  it("one free-roam second on Miller is about 16.8 hours of T (TIMELINES §5)", () => {
    const s = apply(
      state(LOCATIONS.millerSurface),
      { kind: "FreeRoamTick", commandId: "f1", actorId: cooper, dTau: 1 },
      handlers,
    ).state;
    closeRel(s.T, 60436.39643610151);
  });

  it("Earth ages 1.5% faster than Endurance (Murph)", () => {
    const base = state(LOCATIONS.endurance);
    const s: GameState = {
      ...base,
      characters: {
        ...base.characters,
        [murph]: { id: murph, tau: 0, location: LOCATIONS.earthFarm, unavailable: "NOT_INTRODUCED" },
      },
    };
    const out = apply(s, advance("e1", 1000), handlers).state;
    closeRel(tauOf(out, murph), 1015.3153334493912);
  });
});

describe("INV-01 and INV-02 over a long run", () => {
  it("T and every tau never decrease, and each step matches r(loc) × ΔT", () => {
    const handlers = createHandlers({ rates: LOCATION_RATES });
    let s = state(LOCATIONS.millerSurface);
    let rng = 12345;
    for (let i = 0; i < 500; i++) {
      rng = (rng * 1103515245 + 12345) % 2147483648;
      const dTau = 1 + (rng % 600);
      const before = s;
      const out = apply(s, { kind: "FreeRoamTick", commandId: `t${i}`, actorId: cooper, dTau }, handlers);
      expect(out.result.kind).toBe("Ok");
      s = out.state;
      const dT = s.T - before.T;
      expect(dT).toBeGreaterThan(0);
      expect(tauOf(s, cooper) - tauOf(before, cooper)).toBe(dTau);
      closeRel(tauOf(s, romilly) - tauOf(before, romilly), dT);
    }
  });
});
