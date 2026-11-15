import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { actionToCommand } from "../../src/app/actions";
import { createEngine, createInitialState, createRules } from "../../src/domain";
import { stateHash } from "../../src/persistence";

type Step = "interact" | { decision: string; option: string; label: string };
interface Golden {
  note: string;
  paths: Record<string, { steps: Step[]; hash: string }>;
}
const file = new URL("./slice.json", import.meta.url);
const golden = JSON.parse(readFileSync(file, "utf8")) as Golden;

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;

/** Replay a path through the same input-to-command translation the app uses, with counter command ids. */
async function replay(steps: readonly Step[]): Promise<string> {
  const game = createEngine(createInitialState(episode.initial), createRules(episode.tables));
  let n = 0;
  const ctx = {
    newId: () => `golden-${++n}`,
    interactions: episode.interactions,
    activities: episode.tables.activities,
  };
  for (const step of steps) {
    if (step === "interact") {
      const command = actionToCommand({ kind: "Interact" }, game.getState(), ctx);
      if (!command) throw new Error("nothing to interact with");
      game.dispatch(command);
    } else {
      const result = game.dispatch({
        kind: "ResolveDecision",
        commandId: `golden-${++n}`,
        decisionId: step.decision as never,
        optionId: step.option,
      });
      if (result.kind !== "Ok") throw new Error(`${step.decision}:${step.option} gave ${result.kind}`);
    }
  }
  return stateHash({ ...game.getState(), processedCommandIds: [] });
}

describe("golden command-log replay (NFR-01, INV-15)", () => {
  it.each(Object.keys(golden.paths))("%s replays to the recorded state hash", async (name) => {
    const path = golden.paths[name]!;
    const hash = await replay(path.steps);
    if (process.env["UPDATE_GOLDEN"]) {
      path.hash = hash;
      writeFileSync(file, `${JSON.stringify(golden, null, 2)}\n`);
      return;
    }
    expect(hash).toBe(path.hash);
  });

  it("the two paths end in different states", () => {
    const [a, b] = Object.values(golden.paths);
    expect(a!.hash).not.toBe(b!.hash);
    expect(a!.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
