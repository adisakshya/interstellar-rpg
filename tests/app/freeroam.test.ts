import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules, type Command } from "../../src/domain";
import { createFreeRoam, MAX_FRAME_MS, TICK_MS } from "../../src/app/freeroam";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;

function setup(timeScale?: number) {
  const game = createEngine(createInitialState(episode.initial), createRules(episode.tables));
  const log: Command[] = [];
  let n = 0;
  const freeRoam = createFreeRoam({
    getState: game.getState,
    dispatch: (c) => {
      log.push(c);
      return game.dispatch(c);
    },
    newId: () => `tick-${++n}`,
    ...(timeScale === undefined ? {} : { timeScale }),
  });
  return { game, log, freeRoam };
}
/** Feed `ms` of real time in frames of `frameMs`. */
const run = (fr: { frame(ms: number): void }, ms: number, frameMs: number) => {
  for (let t = 0; t < ms; t += frameMs) fr.frame(Math.min(frameMs, ms - t));
};

describe("free-roam accumulator (D-11, ARCHITECTURE §4)", () => {
  it("dispatches one 1 s tick per second of real time, whatever the frame rate", () => {
    const at = (frameMs: number) => {
      const { game, log, freeRoam } = setup();
      run(freeRoam, 5000, frameMs);
      return { ticks: log.length, T: game.getState().T };
    };
    const slow = at(100); // 10 fps
    const fast = at(8); // ~120 fps
    expect(slow.ticks).toBe(5);
    expect(fast.ticks).toBe(5);
    expect(fast.T).toBe(slow.T);
    expect(slow.T).toBeGreaterThan(0);
  });

  it("spends timeScale × 1 s of the actor's proper time per tick", () => {
    const { log, freeRoam } = setup(2.5);
    run(freeRoam, TICK_MS, 50);
    expect(log).toEqual([{ kind: "FreeRoamTick", commandId: "tick-1", actorId: "char.cooper", dTau: 2.5 }]);
  });

  it("does not count a stalled frame as elapsed time", () => {
    const { log, freeRoam } = setup();
    freeRoam.frame(60_000); // a stall, or a tab that was throttled
    expect(log).toHaveLength(0);
    freeRoam.frame(MAX_FRAME_MS);
    expect(log).toHaveLength(0);
  });

  it("advances nothing while paused, and does not bank the paused time", () => {
    const { game, log, freeRoam } = setup();
    run(freeRoam, 900, 100);
    freeRoam.setPaused(true);
    const before = game.getState();
    run(freeRoam, 30_000, 100);
    expect(game.getState()).toBe(before);
    expect(log).toHaveLength(0);
    freeRoam.setPaused(false);
    run(freeRoam, 900, 100); // the 900 ms before the pause is gone: 900 alone is not a tick
    expect(log).toHaveLength(0);
    run(freeRoam, 100, 100);
    expect(log).toHaveLength(1);
  });

  it("stops while the controlled character is unavailable", () => {
    const { game, log, freeRoam } = setup();
    // Hibernating Romilly cannot free-roam; only a controlled, available character spends time.
    game.dispatch({ kind: "SwitchCharacter", commandId: "s1", targetId: "char.romilly" as never });
    game.dispatch({
      kind: "ResolveDecision",
      commandId: "r1",
      decisionId: "decision.hibernate" as never,
      optionId: "hibernate",
    });
    expect(game.getState().characters["char.romilly" as never]!.unavailable).toBe("HIBERNATING");
    game.dispatch({ kind: "SwitchCharacter", commandId: "s2", targetId: "char.cooper" as never });
    expect(freeRoam.active).toBe(true);
    run(freeRoam, 1000, 100);
    expect(log).toHaveLength(1);
  });

  it("opens the prompt and waits when a hard deadline interrupts, then resumes once it is resolved", () => {
    const { game, log, freeRoam } = setup();
    // Jump close to the recall decision, so the next tick crosses its trigger.
    const trigger = 130_542_616;
    game.dispatch({
      kind: "AdvanceTime",
      commandId: "adv",
      actorId: "char.cooper" as never,
      activityId: "scan.beacon",
      dTau: 600,
    });
    expect(game.getState().T).toBeLessThan(trigger);
    let guard = 0;
    while (freeRoam.active && guard++ < 5000) run(freeRoam, TICK_MS, 100);
    const decision = game.getState().decisions["decision.recall" as never];
    expect(decision?.status).toBe("pending");
    expect(freeRoam.active).toBe(false);
    const ticks = log.length;
    run(freeRoam, 10_000, 100);
    expect(log).toHaveLength(ticks); // modal open: nothing runs
    game.dispatch({
      kind: "ResolveDecision",
      commandId: "res",
      decisionId: "decision.recall" as never,
      optionId: "run_now",
    });
    expect(freeRoam.active).toBe(true);
  });
});
