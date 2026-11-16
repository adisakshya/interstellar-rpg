import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules } from "../../src/domain";
import { actionToCommand } from "../../src/app/actions";
import { currentInteraction, offerFor, pendingInteraction } from "../../src/app/interactions";
import { distanceTo, isNearLandmark, MILLER_LANDMARKS } from "../../src/render";
import { makeNearGate } from "../../src/app/gate";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const start = () => createEngine(createInitialState(episode.initial), createRules(episode.tables)).getState();
let n = 0;
const ctx = (isNear?: (l: string) => boolean) => ({
  newId: () => `g-${++n}`,
  interactions: episode.interactions,
  activities: episode.tables.activities,
  isNear,
});

describe("where you stand decides what you can do (PLAY-001)", () => {
  it("offers the scan only at the beacon; elsewhere it is the goal, not an action", () => {
    const state = start();
    expect(pendingInteraction(state, episode.interactions)?.id).toBe("act.scan");
    expect(currentInteraction(state, episode.interactions, () => false)).toBeNull();
    expect(currentInteraction(state, episode.interactions, (l) => l === "beacon")?.id).toBe("act.scan");
    expect(currentInteraction(state, episode.interactions)?.id).toBe("act.scan"); // no gate given: everywhere
  });

  it("makes no command and no offer when the player is away, and both when they arrive", () => {
    const state = start();
    expect(
      actionToCommand(
        { kind: "Interact" },
        state,
        ctx(() => false),
      ),
    ).toBeNull();
    expect(offerFor(state, episode.interactions, episode.tables.rates, () => false)).toBeNull();
    expect(
      actionToCommand(
        { kind: "Interact" },
        state,
        ctx(() => true),
      ),
    ).toMatchObject({ kind: "AdvanceTime", activityId: "scan.beacon" });
    expect(offerFor(state, episode.interactions, episode.tables.rates, () => true)?.label).toBe("Scan the beacon");
  });

  it("gives every gated interaction a landmark that exists and a line to say while the player is away", () => {
    for (const it of episode.interactions) {
      if (it.near === undefined) continue;
      expect(MILLER_LANDMARKS[it.near], it.id).toBeDefined();
      expect(it.goal, it.id).toBeTruthy();
    }
  });
});

describe("landmarks", () => {
  it("count a position as near within the reach, and not beyond it", () => {
    const b = MILLER_LANDMARKS["beacon"]!;
    expect(isNearLandmark("beacon", { x: b.x, z: b.z - b.reach + 0.5 })).toBe(true);
    expect(isNearLandmark("beacon", { x: b.x, z: b.z - b.reach - 1 })).toBe(false);
    expect(isNearLandmark("nowhere", { x: 0, z: 0 })).toBe(false);
    expect(distanceTo(b, { x: b.x + 3, z: b.z + 4 })).toBe(5);
  });

  it("are far enough from the start that walking to them is part of the game, but reachable", () => {
    for (const l of Object.values(MILLER_LANDMARKS)) {
      const d = Math.hypot(l.x, l.z);
      expect(d).toBeGreaterThan(l.reach); // not already there at the start
      expect(d).toBeLessThan(60); // about a minute of wading at Miller's pace
    }
  });
});

describe("the gate fails closed (PLAY-001)", () => {
  it("counts nothing as near while the player's position is not known yet, and follows the position once it is", () => {
    let at: { x: number; z: number } | null = null;
    const isNear = makeNearGate(() => at);
    expect(isNear("beacon")).toBe(false); // the surface scene is still loading
    const b = MILLER_LANDMARKS["beacon"]!;
    at = { x: b.x, z: b.z - 2 };
    expect(isNear("beacon")).toBe(true);
    expect(isNear("wreck")).toBe(false);
    const state = start();
    expect(actionToCommand({ kind: "Interact" }, state, ctx(makeNearGate(() => null)))).toBeNull();
  });
});
