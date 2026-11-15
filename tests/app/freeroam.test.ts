import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules, type Command, type DecisionId } from "../../src/domain";
import { createFreeRoam, MAX_FRAME_MS, TICK_MS } from "../../src/app/freeroam";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;

const ownerOf = (id: DecisionId) => episode.tables.decisions?.[id]?.owner;
const newGame = () => createEngine(createInitialState(episode.initial), createRules(episode.tables));

function setup(timeScale?: number, settled = true) {
  const game = newGame();
  if (settled) {
    // decision.descent opens on the very first tick; the player answers it before roaming (see the modal test below).
    game.dispatch({ kind: "FreeRoamTick", commandId: "warm", actorId: "char.cooper" as never, dTau: 1 });
    game.dispatch({
      kind: "ResolveDecision",
      commandId: "descent",
      decisionId: "decision.descent" as never,
      optionId: "direct",
    });
  }
  const log: Command[] = [];
  let n = 0;
  const freeRoam = createFreeRoam({
    getState: game.getState,
    dispatch: (c) => {
      log.push(c);
      return game.dispatch(c);
    },
    newId: () => `tick-${++n}`,
    ownerOf,
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

  it("waits for the player whenever the controlled character has a prompt open, soft or hard", () => {
    const { game, log, freeRoam } = setup(undefined, false);
    run(freeRoam, TICK_MS, 100); // the first tick makes decision.descent (soft) pending
    expect(game.getState().decisions["decision.descent" as never]?.status).toBe("pending");
    expect(freeRoam.active).toBe(false);
    const T = game.getState().T;
    run(freeRoam, 20_000, 100);
    expect(log).toHaveLength(1);
    expect(game.getState().T).toBe(T);
    game.dispatch({
      kind: "ResolveDecision",
      commandId: "d",
      decisionId: "decision.descent" as never,
      optionId: "efficient",
    });
    expect(freeRoam.active).toBe(true);
    run(freeRoam, TICK_MS, 100);
    expect(log).toHaveLength(2);
  });

  it("does not wait for a prompt that belongs to someone else", () => {
    const { game, freeRoam } = setup();
    // decision.hibernate is Romilly's; it never blocks Cooper's roaming just by being pending.
    expect(ownerOf("decision.hibernate" as never)).toBe("char.romilly");
    expect(game.getState().controlled).toBe("char.cooper");
    expect(freeRoam.active).toBe(true);
  });

  it("opens the prompt and waits when a hard deadline interrupts, then resumes once it is resolved", () => {
    const { game, log, freeRoam } = setup();
    // Roam on, answering the soft prompts that open on the way, until the hard recall decision becomes pending.
    let guard = 0;
    while (game.getState().decisions["decision.recall" as never]?.status !== "pending" && guard++ < 20_000) {
      if (freeRoam.active) {
        run(freeRoam, TICK_MS, 100);
        continue;
      }
      const open = (Object.entries(game.getState().decisions) as unknown as [DecisionId, { status: string }][]).find(
        ([id, d]) =>
          d.status === "pending" && ownerOf(id) === "char.cooper" && id !== ("decision.recall" as DecisionId),
      );
      if (!open) break;
      const option = Object.keys(episode.tables.decisions![open[0]]!.options)[0]!;
      game.dispatch({ kind: "ResolveDecision", commandId: `r-${guard}`, decisionId: open[0], optionId: option });
    }
    expect(game.getState().decisions["decision.recall" as never]?.status).toBe("pending");
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
