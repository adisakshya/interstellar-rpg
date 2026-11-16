import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules } from "../../src/domain";
import { buildHudModel } from "../../src/ui";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;

function atTheWave() {
  const game = createEngine(createInitialState(episode.initial), createRules(episode.tables));
  game.dispatch({
    kind: "AdvanceTime",
    commandId: "a",
    actorId: "char.cooper" as never,
    activityId: "scan.beacon",
    dTau: 600,
  });
  game.dispatch({
    kind: "AdvanceTime",
    commandId: "b",
    actorId: "char.cooper" as never,
    activityId: "search.surface",
    dTau: 1200,
  });
  return game.getState();
}
const ctx = (text: typeof episode.decisionText | undefined) => ({
  names: episode.names,
  decisions: episode.tables.decisions ?? {},
  activities: episode.tables.activities,
  text,
});

describe("authored decision text (TEXT-001)", () => {
  it("replaces the id-derived title and option labels, and carries the sentence on what is at stake", () => {
    const prompt = buildHudModel(atTheWave(), ctx(episode.decisionText)).prompts[0]!;
    expect(prompt.title).toBe("The wave is coming");
    expect(prompt.prompt).toContain("wall of water");
    expect(prompt.options.map((o) => o.label)).toEqual(["Run for the Ranger", "Stay for the recorder"]);
  });

  it("falls back to labels made from the ids when a decision has no authored text", () => {
    const prompt = buildHudModel(atTheWave(), ctx(undefined)).prompts[0]!;
    expect(prompt.title).toBe("Recall");
    expect(prompt.prompt).toBeNull();
    expect(prompt.options.map((o) => o.label)).toEqual(["Leave now", "Stay longer"]);
  });

  it("every option of every shipped decision has an authored label", () => {
    for (const [id, def] of Object.entries(episode.tables.decisions ?? {})) {
      for (const option of Object.keys(def.options)) {
        expect(episode.decisionText[id]?.labels?.[option], `${id}/${option}`).toBeTruthy();
      }
    }
  });
});
