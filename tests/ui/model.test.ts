import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import {
  createEngine,
  createInitialState,
  createRules,
  type DecisionForecast,
  type DecisionId,
  type GameState,
} from "../../src/domain";
import { buildHudModel, formatDuration, labelFromId, spokenDuration } from "../../src/ui";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const YEAR = 365.25 * 86400;
const ctxFor = (forecast?: (id: DecisionId) => DecisionForecast | null) => ({
  names: episode.names,
  decisions: episode.tables.decisions ?? {},
  activities: episode.tables.activities,
  forecast,
});
const start = () => createInitialState(episode.initial);
const patch = (s: GameState, id: string, change: object): GameState => ({
  ...s,
  characters: { ...s.characters, [id]: { ...s.characters[id as never]!, ...change } },
});

describe("durations", () => {
  it.each<[number, string, string]>([
    [45, "45 s", "45 seconds"],
    [310, "5 m 10 s", "5 minutes 10 seconds"],
    [3 * 3600 + 34 * 60 + 17, "3 h 34 m", "3 hours 34 minutes"], // TIMELINES W3 C2
    [60437, "16 h 47 m", "16 hours 47 minutes"], // one free-roam second on Miller
    [3 * 86400, "3 d", "3 days"],
    [25 * YEAR, "25.0 y", "25.0 years"],
    [6.894409814750342 * YEAR, "6.9 y", "6.9 years"], // 1 h on Miller (PHYSICS §4)
  ])("%s s reads as %s", (seconds, text, spoken) => {
    expect(formatDuration(seconds)).toBe(text);
    expect(spokenDuration(seconds)).toBe(spoken);
  });

  it("never prints nonsense for bad input, and turns ids into labels", () => {
    expect(formatDuration(-1)).toBe("–");
    expect(formatDuration(Number.NaN)).toBe("–");
    expect(labelFromId("stay_awake")).toBe("Stay awake");
    expect(labelFromId("decision.hibernate")).toBe("Hibernate");
  });
});

describe("the switcher (FR-03)", () => {
  it("lists only characters the player has met, numbered, with the controlled one marked", () => {
    const m = buildHudModel(start(), ctxFor());
    expect(m.characters.map((c) => [c.slot, c.name, c.controlled, c.switchable, c.reasonText])).toEqual([
      [1, "Cooper", true, true, ""],
      [2, "Romilly", false, true, ""],
    ]);
    expect(m.controlledName).toBe("Cooper");
  });

  it.each<[string, string, string]>([
    ["INJURED", "Injured", "Injured"],
    ["HIBERNATING", "Hibernating", "Hibernating"],
    ["UNCONSCIOUS", "Unconscious", "Unconscious"],
    ["CONTROLLED_BY_OTHER", "Controlled by another player", "Controlled by another player"],
  ])("states %s in words", (reason, expected) => {
    const s = patch(start(), "char.brand", { unavailable: reason });
    const row = buildHudModel(s, ctxFor()).characters.find((c) => c.id === "char.brand")!;
    expect(row).toMatchObject({ switchable: false, reason, reasonText: expected });
  });

  it("names the cause of a death, and explains a locked sequence", () => {
    const dead = patch(patch(start(), "char.brand", { unavailable: "DEAD" }), "char.brand", { cause: "WAVE" });
    expect(buildHudModel(dead, ctxFor()).characters.find((c) => c.id === "char.brand")!.reasonText).toBe("Dead: wave");
    const locked = patch(start(), "char.cooper", { unavailable: "LOCKED_SEQUENCE" });
    const romilly = buildHudModel(locked, ctxFor()).characters.find((c) => c.id === "char.romilly")!;
    expect(romilly.reasonText).toContain("finish the current sequence");
  });

  it("shows each character's own lived time", () => {
    const s = patch(patch(start(), "char.cooper", { tau: 3 * 3600 }), "char.romilly", { tau: 21 * YEAR });
    const rows = buildHudModel(s, ctxFor()).characters;
    expect(rows.map((r) => [r.name, r.lived, r.livedSpoken])).toEqual([
      ["Cooper", "3 h", "3 hours"],
      ["Romilly", "21.0 y", "21.0 years"],
    ]);
    expect(buildHudModel({ ...s, T: 21 * YEAR }, ctxFor()).reference).toBe("21.0 y");
  });
});

describe("decision prompts (C-06)", () => {
  const pending = (s: GameState, id: string): GameState => ({
    ...s,
    decisions: { ...s.decisions, [id]: { status: "pending", optionId: null } },
  });

  it("shows a prompt to the owner, with options, hardness and the time left", () => {
    const game = createEngine(start(), createRules(episode.tables));
    const s = { ...pending(start(), "decision.recall"), controlled: "char.cooper" as never, T: 130542616 };
    const m = buildHudModel(
      s,
      ctxFor((id) => game.forecast(id)),
    );
    const p = m.prompts.find((x) => x.id === "decision.recall")!;
    expect(p.options.map((o) => o.label)).toEqual(["Run now", "Finish search"]);
    expect(p).toMatchObject({ hard: true, title: "Recall" });
    expect(p.deadline).toBe(formatDuration(166804454 - 130542616));
    expect(p.deadlineSpoken).toContain("year");
    expect(m.waiting).toEqual([]);
  });

  it("tells everyone else who the game is waiting on", () => {
    const m = buildHudModel(pending(start(), "decision.hibernate"), ctxFor());
    expect(m.prompts).toEqual([]);
    expect(m.waiting.map((w) => w.text)).toEqual(["Hibernate: waiting on Romilly"]);
    const romilly = buildHudModel(
      { ...pending(start(), "decision.hibernate"), controlled: "char.romilly" as never },
      ctxFor(),
    );
    expect(romilly.prompts.map((p) => p.id)).toEqual(["decision.hibernate"]);
    expect(romilly.waiting).toEqual([]);
  });

  it("does not offer resolved decisions", () => {
    const s: GameState = {
      ...start(),
      decisions: { ["decision.descent" as never]: { status: "resolved", optionId: "direct" } },
    };
    expect(buildHudModel(s, ctxFor()).prompts).toEqual([]);
  });
});

describe("introduction while the controlled character is locked", () => {
  it("still hides characters who have not been introduced, so the slots do not shift", () => {
    const locked = patch(start(), "char.cooper", { unavailable: "LOCKED_SEQUENCE" });
    const model = buildHudModel(locked, ctxFor());
    expect(model.characters.map((c) => c.id)).toEqual(["char.cooper", "char.romilly"]);
    expect(model.characters.map((c) => c.slot)).toEqual([1, 2]);
  });
});
