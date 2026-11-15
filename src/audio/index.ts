// The time tick (AUDIO-001). Music and effects arrive in M2.
import type { CharacterId, GameState, RateTable } from "../domain";
import { createClickSink, type AudioContextLike } from "./synth";
import { createTicker, skippedDays, tickIntervalSeconds, type ClickSink } from "./tick";

export { createClickSink } from "./synth";
export type { AudioContextLike } from "./synth";
export { createTicker, DAY, MAX_RUN_TICKS, skippedDays, SKIP_MIN_SECONDS, tickIntervalSeconds } from "./tick";
export type { ClickSink, Ticker, TickerOptions } from "./tick";

export interface AudioOptions {
  readonly getState: () => GameState;
  readonly rates: RateTable;
  /** Whose days are counted (Romilly, who waits). */
  readonly watcher: CharacterId;
  /** Is the game running in real time right now (freeRoam.active)? */
  readonly active: () => boolean;
  /** Every tick, audible or not: the visual cue. */
  readonly onTick?: () => void;
  /** Days that passed for the watcher in one skip, for a caption. */
  readonly onSkip?: (days: number) => void;
  readonly preference?: { get(): boolean; set(value: boolean): void };
  /** Browsers only allow sound after a gesture, so the context is made on the first one (`unlock`). */
  readonly createContext?: () => AudioContextLike | null;
}

export interface GameAudio {
  /** Call from a user gesture (a click or key press): starts sound where the browser allows it. */
  unlock(): void;
  readonly enabled: boolean;
  setEnabled(value: boolean): void;
  /** Look at a new state: a skip of time plays the run. */
  observe(state: GameState): void;
  dispose(): void;
}

export function createAudio(options: AudioOptions): GameAudio {
  let enabled = options.preference?.get() ?? true;
  let current: ClickSink = {
    now: () => performance.now() / 1000,
    click: () => undefined, // before the first gesture the beat still runs, so the visual cue works
  };
  const sink: ClickSink = { now: () => current.now(), click: (at, p, g) => current.click(at, p, g) };
  const ticker = createTicker({
    sink,
    interval: () => tickIntervalSeconds(options.getState(), options.rates, options.watcher),
    active: options.active,
    enabled: () => enabled,
    ...(options.onTick ? { onTick: options.onTick } : {}),
  });
  let previous = options.getState();
  let unlocked = false;
  ticker.start();

  return {
    unlock() {
      if (unlocked) return;
      const make =
        options.createContext ??
        (() => {
          const Ctor =
            (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext ??
            (globalThis as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
          return Ctor ? new Ctor() : null;
        });
      let ctx: AudioContextLike | null;
      try {
        ctx = make();
      } catch {
        ctx = null;
      }
      unlocked = true;
      if (!ctx) return;
      void (ctx as unknown as { resume?: () => Promise<void> }).resume?.();
      current = createClickSink(ctx);
      ticker.stop();
      ticker.start();
    },
    get enabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
      options.preference?.set(value);
    },
    observe(state) {
      const days = skippedDays(previous, state, options.watcher);
      previous = state;
      if (days === null) return;
      ticker.run(days);
      options.onSkip?.(days);
    },
    dispose() {
      ticker.stop();
    },
  };
}
