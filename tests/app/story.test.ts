import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules } from "../../src/domain";
import { createStory, readMs, storyHolds, type StoryEntry } from "../../src/app/story";
import { livedPhrase } from "../../src/ui";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const fresh = () => createEngine(createInitialState(episode.initial), createRules(episode.tables));

function setup(game = fresh(), entries: readonly StoryEntry[] = episode.story) {
  const timers: { run: () => void; ms: number; live: boolean }[] = [];
  const story = createStory({
    entries,
    getState: game.getState,
    names: episode.names,
    spell: livedPhrase,
    setTimer: (run, ms) => {
      const t = { run, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
  });
  const fire = () => {
    const t = timers.filter((x) => x.live).pop();
    if (t) {
      t.live = false;
      t.run();
    }
  };
  return { game, story, timers, fire };
}
let n = 0;
const scan = (game: ReturnType<typeof fresh>) =>
  game.dispatch({
    kind: "AdvanceTime",
    commandId: `s-${++n}`,
    actorId: "char.cooper" as never,
    activityId: "scan.beacon",
    dTau: 600,
  });

describe("story subtitles (STORY-001)", () => {
  it("opens a new game with the arrival scene, one line at a time", () => {
    const { story, fire } = setup();
    expect(story.current()).toMatchObject({ kind: "card", text: "Miller's planet" });
    const seenText: string[] = [];
    while (story.current()) {
      seenText.push(story.current()!.text);
      fire();
    }
    expect(seenText.length).toBeGreaterThan(4);
    expect(story.log().map((l) => l.text)).toEqual(seenText);
  });

  it("does not replay a scene that already holds in a loaded game", () => {
    const game = fresh();
    scan(game);
    expect(game.getState().seq).toBeGreaterThan(0);
    const { story } = setup(game);
    expect(story.current()).toBeNull();
    story.observe();
    expect(story.current()).toBeNull();
  });

  it("shows a new scene once, when its condition first holds, never twice", () => {
    const game = fresh();
    const { story, fire } = setup(game);
    story.skipAll(); // the arrival scene
    expect(story.current()).toBeNull();
    scan(game);
    story.observe();
    expect(story.current()?.name).toBe("Cooper"); // the beacon scene
    while (story.current()) fire();
    story.observe();
    expect(story.current()).toBeNull();
  });

  it("spells a character's lived time into a title card", () => {
    const entry: StoryEntry = {
      id: "story.t",
      when: { minT: 0 },
      lines: [{ speaker: "card", text: "Romilly. {tau:char.romilly} since you left." }],
    };
    const { story } = setup(fresh(), [entry]);
    expect(story.current()?.text).toBe("Romilly. less than a day since you left.");
  });

  it("turns auto-advance off on request, and skip-all keeps everything in the log", () => {
    const { story, timers } = setup();
    story.setAutoAdvance(false);
    expect(timers.filter((t) => t.live)).toHaveLength(0);
    const total = story.pending() + 1;
    story.skipAll();
    expect(story.current()).toBeNull();
    expect(story.log()).toHaveLength(total);
  });

  it("holds each line for a reading time that grows with its length", () => {
    expect(readMs("Hi")).toBe(2500);
    expect(readMs("x".repeat(100))).toBe(7300);
    expect(readMs("x".repeat(1000))).toBe(9000);
  });

  it("checks every condition of an entry", () => {
    const s = createInitialState(episode.initial);
    expect(storyHolds(s, { start: true })).toBe(true);
    expect(storyHolds(s, { start: true, controlled: "char.romilly" })).toBe(false);
    expect(storyHolds(s, { dead: ["char.doyle"] })).toBe(false);
    expect(storyHolds(s, { decision: [{ id: "decision.recall", status: "pending" }] })).toBe(false);
  });

  it("formats a long wait in a title card's words", () => {
    expect(livedPhrase(23.33 * 365.25 * 86400)).toBe("23 years 3 months");
    expect(livedPhrase(86400 * 200)).toBe("6 months");
    expect(livedPhrase(86400 * 9)).toBe("9 days");
    expect(livedPhrase(10)).toBe("less than a day");
  });
});
