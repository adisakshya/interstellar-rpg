import type { Command, GameState, Result } from "../domain";

/** One free-roam quantum is 1 s of accumulated real time (TIMELINES §5, ARCHITECTURE §4). */
export const TICK_MS = 1000;
/**
 * A single frame can never count for more than this, so a stalled main thread (or a debugger) cannot turn into a
 * burst of ticks when it wakes up. Real time that was not observed is not simulated (INV-13).
 */
export const MAX_FRAME_MS = 250;

export interface FreeRoamOptions {
  readonly getState: () => GameState;
  readonly dispatch: (command: Command) => Result;
  readonly newId: () => string;
  /** Proper seconds spent per real second (content parameter, default 1.0; D-11). */
  readonly timeScale?: number;
}

export interface FreeRoam {
  /** Feed real elapsed time since the last frame. Dispatches at most one tick per accumulated second. */
  frame(deltaMs: number): void;
  /** UI pause: hidden tab, menu or modal. Nothing accumulates while paused, and the remainder is dropped. */
  setPaused(paused: boolean): void;
  readonly paused: boolean;
  /** Is the loop currently allowed to run? False while paused, while the controlled character is
   * unavailable, or while the controlled character owns a pending decision (the prompt is a modal). */
  readonly active: boolean;
}

/**
 * The real-time accumulator (ARCHITECTURE §4). Frame rate never changes outcomes: ticks come from accumulated real
 * time in fixed quanta, and `timeScale` only changes how much proper time a tick spends.
 */
export function createFreeRoam(options: FreeRoamOptions): FreeRoam {
  const scale = options.timeScale ?? 1;
  let accumulated = 0;
  let paused = false;
  /** Set when a tick was Interrupted/Blocked: stay stopped until the decision leaves "pending". */
  let waitingOn: string | null = null;

  const modalOpen = (state: GameState): boolean => {
    if (waitingOn !== null) {
      if (state.decisions[waitingOn as never]?.status === "pending") return true;
      waitingOn = null;
    }
    return false;
  };

  const runnable = (): boolean => {
    if (paused) return false;
    const state = options.getState();
    const me = state.characters[state.controlled];
    if (!me || me.unavailable !== null) return false;
    return !modalOpen(state);
  };

  return {
    frame(deltaMs) {
      if (!runnable()) {
        accumulated = 0;
        return;
      }
      accumulated += Math.min(Math.max(deltaMs, 0), MAX_FRAME_MS);
      // At most one tick per frame: MAX_FRAME_MS < TICK_MS means a frame cannot owe more than one.
      if (accumulated < TICK_MS) return;
      accumulated -= TICK_MS;
      const state = options.getState();
      const result = options.dispatch({
        kind: "FreeRoamTick",
        commandId: options.newId(),
        actorId: state.controlled,
        dTau: (TICK_MS / 1000) * scale,
      });
      if (result.kind === "Interrupted" || result.kind === "Blocked") {
        waitingOn = result.decisionId;
        accumulated = 0;
      }
    },
    setPaused(next) {
      paused = next;
      accumulated = 0;
    },
    get paused() {
      return paused;
    },
    get active() {
      return runnable();
    },
  };
}
