// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchEnding, type EndingOptions } from "../../src/app/ending";
import { createInitialState, type GameState, type InitialSpec } from "../../src/domain";

const cooper = "char.cooper" as never;
const spec: InitialSpec = {
  contentVersion: "t",
  controlled: cooper,
  characters: [{ id: cooper, location: "loc.miller_surface" as never, unavailable: null }],
  resources: {},
  seed: 1,
};
const done = (s: GameState): GameState => ({
  ...s,
  knowledge: { ...s.knowledge, [cooper]: ["fact.lifted_off"] as never },
});
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
};

afterEach(() => document.body.replaceChildren());

function setup(over: Partial<EndingOptions["slots"]> = {}, finished = false) {
  let state = finished ? done(createInitialState(spec)) : createInitialState(spec);
  const listeners = new Set<(state: GameState, events: readonly never[]) => void>();
  const root = document.createElement("div");
  document.body.append(root);
  const reload = vi.fn();
  const newGame = vi.fn();
  const onError = vi.fn();
  const restoreCheckpoint = vi.fn(async () => ({ ok: true as const, save: {} as never }));
  const stop = watchEnding({
    game: { getState: () => state, subscribe: (l) => (listeners.add(l), () => listeners.delete(l)) },
    episode: {
      names: { "char.cooper": "Cooper" },
      facts: {},
      outcomeNotes: [],
      ending: { fact: "fact.lifted_off", knownBy: "char.cooper" },
    },
    slots: {
      listCheckpoints: async () => [
        { key: "checkpoint/2", seq: 9, decisionId: "decision.recall" },
        { key: "checkpoint/1", seq: 4, decisionId: "decision.hibernate" },
      ],
      restoreCheckpoint,
      ...over,
    },
    root,
    reload,
    newGame,
    onError,
  });
  const finish = () => {
    state = done(state);
    for (const l of [...listeners]) l(state, []);
  };
  return { root, reload, newGame, onError, restoreCheckpoint, stop, finish };
}
const labels = (root: HTMLElement) => [...root.querySelectorAll("button")].map((b) => b.textContent);

describe("the ending (SLICE-001)", () => {
  it("opens once, when the ending is reached, with a way back to each checkpoint and a new game", async () => {
    const t = setup();
    await flush();
    expect(t.root.querySelector('[role="dialog"]')).toBeNull();
    t.finish();
    t.finish(); // further commits while it is opening or open do not stack dialogs
    await flush();
    expect(t.root.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(labels(t.root)).toEqual([
      'Go back to "Recall" and choose differently',
      'Go back to "Hibernate" and choose differently',
      "Start a new game",
    ]);
  });

  it("opens straight away when a finished game is loaded", async () => {
    const t = setup({}, true);
    await flush();
    expect(t.root.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("restores the chosen checkpoint, then reloads", async () => {
    const t = setup({}, true);
    await flush();
    t.root.querySelectorAll("button")[0]!.click();
    await flush();
    expect(t.restoreCheckpoint).toHaveBeenCalledWith("checkpoint/2");
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the checkpoint cannot be restored, and says so", async () => {
    const t = setup(
      {
        restoreCheckpoint: async () => ({
          ok: false as const,
          code: "HASH_MISMATCH" as const,
          detail: "x",
          quarantinedAs: "q",
        }),
      },
      true,
    );
    await flush();
    t.root.querySelectorAll("button")[0]!.click();
    await flush();
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("HASH_MISMATCH") }),
    );
  });

  it("still opens, with just a new game, when the checkpoint list cannot be read", async () => {
    const t = setup({ listCheckpoints: async () => Promise.reject(new Error("idb")) }, true);
    await flush();
    expect(labels(t.root)).toEqual(["Start a new game"]);
    expect(t.onError).toHaveBeenCalled();
    t.root.querySelectorAll("button")[0]!.click();
    expect(t.newGame).toHaveBeenCalledTimes(1);
  });

  it("closes when stopped", async () => {
    const t = setup({}, true);
    await flush();
    t.stop();
    expect(t.root.querySelector('[role="dialog"]')).toBeNull();
  });
});
