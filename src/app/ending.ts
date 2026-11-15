import type { LoadedEpisode } from "../content";
import type { GameEngine } from "../domain";
import type { CheckpointInfo, LoadResult } from "../persistence";
import { buildOutcome, isFinished, labelFromId, mountOutcome, type OutcomeView } from "../ui";

export interface EndingOptions {
  readonly game: Pick<GameEngine, "getState" | "subscribe">;
  readonly episode: Pick<LoadedEpisode, "names" | "facts" | "outcomeNotes" | "ending">;
  readonly slots: {
    listCheckpoints(): Promise<readonly CheckpointInfo[]>;
    restoreCheckpoint(key: string): Promise<LoadResult>;
  };
  readonly root: HTMLElement;
  /** Elements to hide from assistive technology while the dialog is open. */
  readonly behind?: readonly HTMLElement[];
  /** Load whatever is now in the autosave. */
  readonly reload: () => void;
  /** Start a new game, ignoring the autosave. */
  readonly newGame: () => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Open the outcome screen once the episode's ending fact is learned, now or later. It offers a way back to each
 * automatic checkpoint (the only rewind, TIMELINES §8) so a different choice can be tried, and a new game.
 */
export function watchEnding(options: EndingOptions): () => void {
  const report = (error: unknown) => (options.onError ?? console.error)(error);
  let view: OutcomeView | null = null;
  let opening = false;

  async function open(): Promise<void> {
    if (view || opening) return;
    opening = true;
    try {
      const state = options.game.getState();
      const model = buildOutcome(state, {
        names: options.episode.names,
        facts: options.episode.facts,
        notes: options.episode.outcomeNotes,
        ending: options.episode.ending,
      });
      let checkpoints: readonly CheckpointInfo[] = [];
      try {
        checkpoints = await options.slots.listCheckpoints();
      } catch (error) {
        report(error); // the dialog is still useful without the replay list
      }
      const actions = checkpoints.map((c) => {
        const action = {
          label: `Go back to "${labelFromId(c.decisionId)}" and choose differently`,
          run: () => {
            options.slots.restoreCheckpoint(c.key).then((out) => {
              if (out.ok) options.reload();
              else report(new Error(`checkpoint could not be loaded: ${out.code}`));
            }, report);
          },
        };
        return action;
      });
      actions.push({ label: "Start a new game", run: options.newGame });
      view = mountOutcome(options.root, model, actions, options.behind);
    } finally {
      opening = false;
    }
  }

  const check = () => {
    if (isFinished(options.game.getState(), options.episode.ending)) void open().catch(report);
  };
  const stop = options.game.subscribe(check);
  check();
  return () => {
    stop();
    view?.dispose();
    view = null;
  };
}
