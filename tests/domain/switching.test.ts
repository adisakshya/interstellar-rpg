import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LOCATIONS } from "../../src/content";
import {
  apply,
  asId,
  createHandlers,
  SCHEMA_VERSION,
  switchView,
  type CharacterId,
  type GameState,
  type RateTable,
  type TimeTables,
  type UnavailableReason,
} from "../../src/domain";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const brand = asId("char", "char.brand");
const murph = asId("char", "char.murph");
const doyle = asId("char", "char.doyle");
const ghost = asId("char", "char.nobody");
const RATES: RateTable = { [LOCATIONS.millerSurface]: 1 / 61362, [LOCATIONS.endurance]: 1, [LOCATIONS.earthFarm]: 1 };
const TABLES: TimeTables = {
  rates: RATES,
  activities: {
    "fly.descent": { atomic: false, piloting: true, assist: true },
    "fly.docking": { atomic: true, piloting: true, assist: false },
    "fly.landing": { atomic: false, piloting: true, assist: false },
  },
};
const h = createHandlers(TABLES);

function start(overrides: Partial<Record<CharacterId, UnavailableReason | null>> = {}): GameState {
  const ch = (id: CharacterId, location: (typeof LOCATIONS)[keyof typeof LOCATIONS]) => ({
    id,
    tau: 0,
    location,
    unavailable: overrides[id] ?? null,
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: "test",
    T: 0,
    seq: 0,
    controlled: cooper,
    characters: {
      [cooper]: ch(cooper, LOCATIONS.millerSurface),
      [romilly]: ch(romilly, LOCATIONS.endurance),
      [brand]: ch(brand, LOCATIONS.millerSurface),
      [murph]: ch(murph, LOCATIONS.earthFarm),
      [doyle]: ch(doyle, LOCATIONS.millerSurface),
    },
    resources: { "res.endurance.supplies": { amount: 30 } },
    decisions: {},
    knowledge: { [cooper]: [asId("fact", "fact.beacon_age")] },
    playerSeen: [asId("fact", "fact.beacon_age")],
    messages: [],
    activities: {},
    processedCommandIds: ["cmd-0"],
    rng: { seed: 7, state: 99 },
  };
}

const without = (s: GameState) => ({ ...s, controlled: null });

describe("availability reason codes (TIMELINES §4, FR-03)", () => {
  const reasons: UnavailableReason[] = [
    "NOT_INTRODUCED",
    "HIBERNATING",
    "INJURED",
    "UNCONSCIOUS",
    "DEAD",
    "CONTROLLED_BY_OTHER",
  ];
  it.each(reasons)("switching to a %s character is rejected with that reason", (reason) => {
    const t = start({ [brand]: reason });
    const out = apply(t, { kind: "SwitchCharacter", commandId: "s1", targetId: brand }, h);
    expect(out.result).toEqual({ kind: "Rejected", code: "CHARACTER_UNAVAILABLE", detail: reason });
    expect(out.state).toBe(t);
    const row = switchView(t).options.find((o) => o.characterId === brand)!;
    expect(row).toMatchObject({ switchable: false, reason });
  });

  it("shows the cause of death in the switcher", () => {
    const base = start({ [doyle]: "DEAD" });
    const s: GameState = {
      ...base,
      characters: { ...base.characters, [doyle]: { ...base.characters[doyle]!, cause: "WAVE" } },
    };
    expect(switchView(s).options.find((o) => o.characterId === doyle)).toEqual({
      characterId: doyle,
      controlled: false,
      switchable: false,
      reason: "DEAD",
      cause: "WAVE",
    });
  });

  it("marks every other row LOCKED_SEQUENCE while the controlled character is locked", () => {
    const s = start({ [cooper]: "LOCKED_SEQUENCE" });
    const rows = switchView(s).options;
    expect(rows.filter((o) => !o.controlled).every((o) => !o.switchable && o.reason === "LOCKED_SEQUENCE")).toBe(true);
    expect(rows.find((o) => o.controlled)).toMatchObject({ characterId: cooper, switchable: true });
  });

  it("agrees with the command handler for every row", () => {
    const s = start({ [brand]: "INJURED", [murph]: "NOT_INTRODUCED" });
    for (const row of switchView(s).options) {
      const out = apply(
        s,
        { kind: "SwitchCharacter", commandId: `s-${row.characterId}`, targetId: row.characterId },
        h,
      );
      expect(out.result.kind === "Ok").toBe(row.switchable);
    }
  });
});

describe("piloting hand-off (TIMELINES §4)", () => {
  const flying = (activityId: string): GameState => ({
    ...start(),
    activities: { [cooper]: { activityId, actorId: cooper, progress: 0.4 } },
  });

  it("an assisted flight lets the player switch away and reports the autopilot hand-off", () => {
    const s = flying("fly.descent");
    expect(switchView(s, TABLES.activities).handoff).toBe("ASSIST");
    expect(apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, h).result.kind).toBe("Ok");
  });

  it("a flight with no assist locks switching away", () => {
    const s = flying("fly.docking");
    expect(switchView(s, TABLES.activities).handoff).toBe("NONE");
    expect(apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, h).result).toEqual({
      kind: "Rejected",
      code: "LOCKED_SEQUENCE",
    });
  });
});

describe("no-assist flights never deadlock at another owner's deadline", () => {
  it("blocks the flight before it starts, so the player can switch and resolve", () => {
    const dRomilly = asId("decision", "decision.romilly_call");
    const tables: TimeTables = {
      ...TABLES,
      decisions: {
        [dRomilly]: {
          id: dRomilly,
          owner: romilly,
          triggerT: 10,
          deadlineT: 20,
          checkpoint: false,
          options: { ok: [] },
        },
      },
    };
    const hh = createHandlers(tables);
    const onShip = (s: GameState): GameState => ({
      ...s,
      characters: { ...s.characters, [cooper]: { ...s.characters[cooper]!, location: LOCATIONS.endurance } },
    });
    const s = onShip(start());
    const fly = apply(
      s,
      { kind: "AdvanceTime", commandId: "f1", actorId: cooper, activityId: "fly.landing", dTau: 60 },
      hh,
    );
    expect(fly.result).toEqual({ kind: "Blocked", decisionId: dRomilly, deadlineT: 20 });
    expect(fly.state).toBe(s);
    const switched = apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: romilly }, hh);
    expect(switched.result.kind).toBe("Ok");
    const resolved = apply(
      switched.state,
      { kind: "ResolveDecision", commandId: "r1", decisionId: dRomilly, optionId: "ok" },
      hh,
    );
    expect(resolved.result.kind).toBe("Ok");
    const back = apply(resolved.state, { kind: "SwitchCharacter", commandId: "s2", targetId: cooper }, hh).state;
    expect(
      apply(back, { kind: "AdvanceTime", commandId: "f2", actorId: cooper, activityId: "fly.landing", dTau: 60 }, hh)
        .result.kind,
    ).toBe("Ok");
  });
});

describe("INV-03: switching changes only the controlled character", () => {
  it("W2: 100 round trips leave everything but `controlled` identical", () => {
    let s = apply(
      start(),
      { kind: "AdvanceTime", commandId: "a1", actorId: cooper, activityId: "scan", dTau: 3600 },
      h,
    ).state;
    const before = s;
    for (let i = 0; i < 100; i++) {
      s = apply(s, { kind: "SwitchCharacter", commandId: `r${i}`, targetId: romilly }, h).state;
      s = apply(s, { kind: "SwitchCharacter", commandId: `c${i}`, targetId: cooper }, h).state;
    }
    expect(s).toEqual(before);
    expect(s.knowledge[romilly]).toBeUndefined();
    expect(s.playerSeen).toContain(asId("fact", "fact.beacon_age"));
  });

  it("holds for any sequence of switch targets and availability states (property)", () => {
    const ids = [cooper, romilly, brand, murph, doyle, ghost];
    const reason = fc.constantFrom<UnavailableReason | null>(
      null,
      null,
      "INJURED",
      "DEAD",
      "NOT_INTRODUCED",
      "LOCKED_SEQUENCE",
    );
    fc.assert(
      fc.property(
        fc.record({
          brand: reason,
          murph: reason,
          doyle: reason,
          cooper: fc.constantFrom<UnavailableReason | null>(null, "LOCKED_SEQUENCE"),
        }),
        fc.array(fc.constantFrom(...ids), { maxLength: 60 }),
        (states, targets) => {
          const s0 = start({
            [brand]: states.brand,
            [murph]: states.murph,
            [doyle]: states.doyle,
            [cooper]: states.cooper,
          });
          let s = s0;
          targets.forEach((targetId, i) => {
            const out = apply(s, { kind: "SwitchCharacter", commandId: `p${i}`, targetId }, h);
            if (out.result.kind === "Ok") {
              expect(out.result.events).toEqual([]);
              expect(targetId === s.controlled || out.state.characters[targetId]!.unavailable === null).toBe(true);
            } else {
              expect(out.state).toBe(s);
            }
            s = out.state;
          });
          expect(without(s)).toEqual(without(s0));
        },
      ),
      { seed: 20261115, numRuns: 300 },
    );
  });
});
