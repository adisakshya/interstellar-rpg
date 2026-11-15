import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { FIXTURE_RATES, formatPath, loadEpisode } from "../../src/content";
import { apply, createHandlers, createInitialState, switchView, type Command } from "../../src/domain";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests mutate raw JSON freely
type Json = Record<string, any>;
const clone = (): Json => structuredClone(m1) as Json;
const errorsOf = (json: unknown) => {
  const out = loadEpisode(json);
  if (out.ok) throw new Error("expected the episode to be rejected");
  return out.errors;
};

describe("placeholder M1 episode", () => {
  const out = loadEpisode(m1);
  if (!out.ok) throw new Error(out.errors.join("\n"));
  const ep = out.episode;

  it("loads, takes rates from the physics fixture, and starts a playable game", () => {
    expect(ep.tables.rates["loc.miller_surface" as never]).toBe(FIXTURE_RATES["miller_surface"]);
    expect(ep.tables.rates["loc.miller_wreck" as never]).toBe(FIXTURE_RATES["miller_surface"]);
    expect(ep.tables.rates["loc.ranger" as never]).toBeUndefined();
    const s = createInitialState(ep.initial);
    expect(s.controlled).toBe("char.cooper");
    expect(s.resources["res.endurance_supplies"]).toEqual({ amount: 30 });
    expect(
      switchView(s)
        .options.filter((o) => o.switchable)
        .map((o) => o.characterId),
    ).toEqual(["char.cooper", "char.romilly"]);
  });

  it("drives the domain: scanning the beacon teaches Cooper both beacon facts", () => {
    const h = createHandlers(ep.tables);
    const scan: Command = {
      kind: "AdvanceTime",
      commandId: "c1",
      actorId: "char.cooper" as never,
      activityId: "scan.beacon",
      dTau: 600,
    };
    const r = apply(createInitialState(ep.initial), scan, h);
    expect(r.result.kind).toBe("Ok");
    expect(r.state.knowledge["char.cooper" as never]).toEqual(["fact.beacon_active", "fact.beacon_local_age"]);
    expect(r.state.T / (365.25 * 86400)).toBeCloseTo(1.15, 2); // GDD B4: 10 min ≈ 1.15 yr for Romilly
  });

  it("lets Romilly hibernate and wakes him at docking (TIMELINES §4 wake fallback)", () => {
    const h = createHandlers(ep.tables);
    let s = createInitialState(ep.initial);
    s = apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: "char.romilly" as never }, h).state;
    s = apply(
      s,
      { kind: "ResolveDecision", commandId: "r1", decisionId: "decision.hibernate" as never, optionId: "hibernate" },
      h,
    ).state;
    expect(s.characters["char.romilly" as never]!.unavailable).toBe("HIBERNATING");
    s = apply(s, { kind: "SwitchCharacter", commandId: "s2", targetId: "char.cooper" as never }, h).state;
    // Play on until docking becomes pending (it triggers at the recall deadline, which holds T there).
    s = apply(s, { kind: "FreeRoamTick", commandId: "t1", actorId: "char.cooper" as never, dTau: 3600 }, h).state;
    expect(s.decisions["decision.docking" as never]?.status).toBe("pending");
    s = apply(
      s,
      { kind: "ResolveDecision", commandId: "r2", decisionId: "decision.docking" as never, optionId: "dock" },
      h,
    ).state;
    expect(s.characters["char.romilly" as never]!.unavailable).toBeNull();
  });

  it("references only ids defined in the file", () => {
    const defined = new Set<string>([
      ...m1.characters.map((c) => c.id),
      ...m1.locations.map((l) => l.id),
      ...m1.facts.map((f) => f.id),
      ...m1.decisions.map((d) => d.id),
      ...m1.resources.map((r) => r.id),
    ]);
    const used = JSON.stringify(m1).match(/"(char|loc|fact|decision|res)\.[a-z_]+"/g) ?? [];
    for (const id of used) expect(defined).toContain(JSON.parse(id));
  });
});

describe("invalid content fails with a precise error", () => {
  it("formats paths like beats[3].requires[0]", () => {
    expect(formatPath(["beats", 3, "requires", 0])).toBe("beats[3].requires[0]");
  });

  it.each<[string, (e: Json) => void, string]>([
    [
      "an unknown character in a beat",
      (e) => (e.beats[3].requires[1] = "char.nobody"),
      'beats[3].requires[1]: unknown character "char.nobody"',
    ],
    [
      "an unknown decision in a beat",
      (e) => (e.beats[0].decision = "decision.nope"),
      'beats[0].decision: unknown decision "decision.nope"',
    ],
    [
      "an unknown fact in an activity",
      (e) => (e.activities[0].learns[1] = "fact.nope"),
      'activities[0].learns[1]: unknown fact "fact.nope"',
    ],
    [
      "an unknown physics rate",
      (e) => (e.locations[0].rate = "warp"),
      'locations[0].rate: unknown physics rate "warp"',
    ],
    ["a duplicate id", (e) => (e.facts[1].id = e.facts[0].id), 'facts[1].id: duplicate fact "fact.beacon_active"'],
    [
      "a character starting on a transit-only place",
      (e) => (e.characters[0].location = "loc.ranger"),
      'characters[0].location: "loc.ranger" has no clock rate',
    ],
    ["an unplayable start", (e) => (e.controlled = "char.brand"), 'controlled: "char.brand" must be playable'],
    [
      "a decision without a trigger",
      (e) => delete e.decisions[0].triggerT,
      "decisions[0]: needs triggerT or triggerWhen",
    ],
    [
      "a deadline before its trigger",
      (e) => (e.decisions[3].deadlineT = 1),
      "decisions[3].deadlineT: deadline 1 is before trigger",
    ],
    [
      "an unknown resource level",
      (e) => (e.decisions[4].triggerWhen.resourceId = "res.nope"),
      'decisions[4].triggerWhen.resourceId: unknown resource "res.nope"',
    ],
    ["a wrong id prefix", (e) => (e.characters[0].id = "cooper"), "characters[0].id:"],
    ["an unknown field", (e) => (e.facts[0].colour = "red"), "facts[0]:"],
    ["a negative rate", (e) => (e.resources[0].rate = -1), "resources[0].rate:"],
    [
      "an inherited name as a rate key",
      (e) => (e.locations[0].rate = "constructor"),
      'locations[0].rate: unknown physics rate "constructor"',
    ],
    [
      "an NPC that starts available",
      (e) => (e.characters[2].availability = null),
      'characters[2].availability: "char.brand" is not playable',
    ],
    [
      "an effect that makes an NPC available",
      (e) => e.decisions[0].options.direct.push({ kind: "SetAvailability", characterId: "char.brand", reason: null }),
      'decisions[0].options.direct[0].reason: "char.brand" is not playable',
    ],
    [
      "an incapacitation with no wake fallback",
      (e) => (e.decisions[5].options.dock = []),
      'decisions[4].options.hibernate[0].reason: HIBERNATING for "char.romilly" has no wake fallback',
    ],
  ])("%s", (_name, mutate, expected) => {
    const e = clone();
    mutate(e);
    expect(errorsOf(e).some((m) => m.startsWith(expected))).toBe(true);
  });

  it("reports every problem at once, not just the first", () => {
    const e = clone();
    e.beats[0].requires[0] = "char.a";
    e.beats[1].requires[0] = "char.b";
    expect(errorsOf(e)).toHaveLength(2);
  });
});
