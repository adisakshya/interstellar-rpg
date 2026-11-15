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
    // Answer the wave warning early (a hard decision may be), then play on until docking becomes pending.
    s = apply(
      s,
      { kind: "ResolveDecision", commandId: "r0", decisionId: "decision.recall" as never, optionId: "leave_now" },
      h,
    ).state;
    s = apply(s, { kind: "FreeRoamTick", commandId: "t1", actorId: "char.cooper" as never, dTau: 9000 }, h).state;
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
      (e) => (e.decisions[0].deadlineT = 1),
      "decisions[0].deadlineT: deadline 1 is before trigger",
    ],
    [
      "an unknown resource level",
      (e) => (e.decisions[1].triggerWhen.resourceId = "res.nope"),
      'decisions[1].triggerWhen.resourceId: unknown resource "res.nope"',
    ],
    ["a wrong id prefix", (e) => (e.characters[0].id = "cooper"), "characters[0].id:"],
    ["an unknown field", (e) => (e.facts[0].colour = "red"), "facts[0]:"],
    ["a negative rate", (e) => (e.resources[0].rate = -1), "resources[0].rate:"],
    [
      "a decision owned by an NPC",
      (e) => (e.decisions[1].owner = "char.brand"),
      'decisions[1].owner: "char.brand" is not playable',
    ],
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
      (e) =>
        e.decisions[0].options.leave_now.push({ kind: "SetAvailability", characterId: "char.brand", reason: null }),
      'decisions[0].options.leave_now[0].reason: "char.brand" is not playable',
    ],
    [
      "an incapacitation with no wake fallback",
      (e) => (e.decisions[2].options.dock = []),
      'decisions[1].options.hibernate[0].reason: HIBERNATING for "char.romilly" has no wake fallback',
    ],
  ])("%s", (_name, mutate, expected) => {
    const e = clone();
    mutate(e);
    expect(errorsOf(e).some((m) => m.startsWith(expected))).toBe(true);
  });

  it.each<[string, (e: Json) => void, string]>([
    [
      "a hazard on an unknown decision",
      (e) => (e.hazards[0].atDeadlineOf = "decision.nope"),
      'hazards[0].atDeadlineOf: unknown decision "decision.nope"',
    ],
    [
      "a hazard for an option that does not exist",
      (e) => (e.hazards[0].whenOption = "dither"),
      'hazards[0].whenOption: decision "decision.recall" has no option "dither"',
    ],
    [
      "a hazard on a decision with no fixed deadline",
      (e) => (e.hazards[0].atDeadlineOf = "decision.docking"),
      'hazards[0].atDeadlineOf: "decision.docking" has no fixed deadline',
    ],
    [
      "a hazard that makes an NPC switchable",
      (e) => (e.hazards[0].effects[0] = { kind: "SetAvailability", characterId: "char.doyle", reason: null }),
      'hazards[0].effects[0].reason: "char.doyle" is not playable and cannot be made available',
    ],
    [
      "a hazard that, with its choice, kills every playable character",
      (e) =>
        e.hazards[0].effects.push(
          { kind: "SetAvailability", characterId: "char.cooper", reason: "DEAD", cause: "wave" },
          { kind: "SetAvailability", characterId: "char.romilly", reason: "DEAD", cause: "x" },
        ),
      "hazards[0]: with its choice, kills every playable character",
    ],
    [
      "a hazard that acts on a playable character",
      (e) =>
        (e.hazards[0].effects[0] = {
          kind: "SetAvailability",
          characterId: "char.cooper",
          reason: "DEAD",
          cause: "wave",
        }),
      'hazards[0].effects[0].characterId: "char.cooper" is playable: a hazard may only act on non-playable characters',
    ],
    [
      "a duplicate hazard id",
      (e) => e.hazards.push({ ...e.hazards[0] }),
      'hazards[1].id: duplicate hazard "hazard.wave"',
    ],
    [
      "an interaction at an unknown place",
      (e) => (e.interactions[0].location = "loc.nowhere"),
      'interactions[0].location: unknown location "loc.nowhere"',
    ],
    [
      "an interaction with an unknown activity",
      (e) => (e.interactions[0].activityId = "scan.nothing"),
      'interactions[0].activityId: unknown activity "scan.nothing"',
    ],
    [
      "an interaction gated on an unknown fact",
      (e) => (e.interactions[1].requires = ["fact.nope"]),
      'interactions[1].requires[0]: unknown fact "fact.nope"',
    ],
    [
      "an interaction gated on an unknown decision",
      (e) => (e.interactions[2].after = ["decision.nope"]),
      'interactions[2].after[0]: unknown decision "decision.nope"',
    ],
    [
      "a duplicate interaction id",
      (e) => (e.interactions[1].id = e.interactions[0].id),
      'interactions[1].id: duplicate interaction "act.scan"',
    ],
    [
      "time spent by someone other than the decision owner",
      (e) => (e.decisions[0].options.stay_longer[1].characterId = "char.romilly"),
      'decisions[0].options.stay_longer[1].characterId: "char.romilly" is not the decision owner "char.cooper"',
    ],
    [
      "supplies that can run out with no hard decision (INV-11)",
      (e) => delete e.decisions[1].deadlineWhen,
      'resources[0]: "res.endurance_supplies" can run out for playable "char.romilly" with no hard decision tied to it (INV-11)',
    ],
    [
      "a choice that kills every playable character",
      (e) => {
        e.decisions[0].options.leave_now.push(
          { kind: "SetAvailability", characterId: "char.cooper", reason: "DEAD", cause: "wave" },
          { kind: "SetAvailability", characterId: "char.romilly", reason: "DEAD", cause: "starvation" },
        );
      },
      "decisions[0].options.leave_now: kills every playable character, so no path would remain",
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

describe("story entries (STORY-001)", () => {
  it("must reference real characters, facts, decisions and options, and need a condition and a line", () => {
    const bad = clone();
    bad.story = [
      { id: "story.x", when: { controlled: "char.nobody" }, lines: [{ speaker: "char.cooper", text: "Hi" }] },
      {
        id: "story.y",
        when: { knows: [{ by: "char.cooper", fact: "fact.nope" }] },
        lines: [{ speaker: "narrator", text: "{tau:char.ghost}" }],
      },
      {
        id: "story.z",
        when: { decision: [{ id: "decision.recall", status: "resolved", option: "fly" }] },
        lines: [{ speaker: "card", text: "x" }],
      },
      {
        id: "story.w",
        when: { decision: [{ id: "decision.recall", status: "pending", option: "leave_now" }] },
        lines: [{ speaker: "card", text: "x" }],
      },
    ];
    const errors = errorsOf(bad).join("\n");
    expect(errors).toContain('story[0].when.controlled: unknown character "char.nobody"');
    expect(errors).toContain('story[1].when.knows[0].fact: unknown fact "fact.nope"');
    expect(errors).toContain('story[1].lines[0].text: unknown character "char.ghost"');
    expect(errors).toContain('story[2].when.decision[0].option: decision "decision.recall" has no option "fly"');
    expect(errors).toContain("story[3].when.decision[0].option: an option only exists once the decision is resolved");
  });

  it("needs at least one condition", () => {
    const bad = clone();
    bad.story = [{ id: "story.v", when: {}, lines: [{ speaker: "card", text: "x" }] }];
    expect(errorsOf(bad).join("\n")).toContain("story[0].when: a story entry needs at least one condition");
  });

  it("rejects duplicate ids, and the shipped M1 story loads", () => {
    const dup = clone();
    dup.story = [dup.story[0], dup.story[0]];
    expect(errorsOf(dup).join("\n")).toContain('duplicate story entry "story.arrival"');
    const out = loadEpisode(m1);
    expect(out.ok && out.episode.story.length).toBeGreaterThan(8);
  });
});

describe("decision text (TEXT-001)", () => {
  it("rejects a label for an option the decision does not have", () => {
    const bad = clone();
    bad.decisions[0].labels = { fly: "Fly" };
    expect(errorsOf(bad).join("\n")).toContain(
      'decisions[0].labels.fly: decision "decision.recall" has no option "fly"',
    );
  });
});
