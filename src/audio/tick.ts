import type { CharacterId, GameState, RateTable } from "../domain";

/** One tick is one day of the watcher's time (D-18, ART_DIRECTION §6). */
export const DAY = 86_400;

/**
 * Seconds of the controlled character's own time between ticks, or null when the tick is silent. A day passes for the
 * watcher (Romilly) every `86 400 × r(here) / r(watcher)` seconds of the controlled character's time; on Miller that is
 * about 1.43 s. While the watcher is the one controlled, a day passes in a day and there is nothing to hear.
 */
export function tickIntervalSeconds(state: GameState, rates: RateTable, watcherId: CharacterId): number | null {
  const me = state.characters[state.controlled];
  const watcher = state.characters[watcherId];
  if (!me || !watcher || me.id === watcher.id) return null;
  const here = rates[me.location];
  const there = rates[watcher.location];
  if (here === undefined || there === undefined || !(here > 0) || !(there > 0)) return null;
  return (DAY * here) / there;
}

/** A single action carried more than this much of the controlled character's time: it is a skip, not free-roam. */
export const SKIP_MIN_SECONDS = 2.5;

/**
 * How many whole days passed for the watcher in one change of state, when that change was a skip of time by the
 * controlled character (a scan, a search, an hour spent on a choice). Null for free-roam ticks, switches and anything
 * that did not move the watcher's calendar.
 */
export function skippedDays(prev: GameState, next: GameState, watcherId: CharacterId): number | null {
  if (prev.controlled !== next.controlled || next.controlled === watcherId) return null;
  const a = prev.characters[prev.controlled];
  const b = next.characters[next.controlled];
  const wa = prev.characters[watcherId];
  const wb = next.characters[watcherId];
  if (!a || !b || !wa || !wb) return null;
  if (b.tau - a.tau <= SKIP_MIN_SECONDS) return null;
  const days = Math.floor(wb.tau / DAY) - Math.floor(wa.tau / DAY);
  return days > 0 ? days : null;
}

/** Where a click goes. The browser implementation is in `synth.ts`; tests use a recorder. */
export interface ClickSink {
  now(): number;
  /** Silence or restore everything already queued, not just later clicks. Optional: a sink with no queue ignores it. */
  mute?(muted: boolean): void;
  /** A short click at `at` (sink clock, seconds). `pitch` 1 is the base tone; `gain` is 0..1. */
  click(at: number, pitch: number, gain: number): void;
}

export interface TickerOptions {
  readonly sink: ClickSink;
  /** Seconds between ticks right now, or null for silence. */
  readonly interval: () => number | null;
  /** Is the game running in real time (not paused, held by a prompt or subtitle, or finished)? */
  readonly active: () => boolean;
  readonly enabled: () => boolean;
  /** Called once per audible or silent-muted tick, for the visual cue. */
  readonly onTick?: (index: number) => void;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface Ticker {
  start(): void;
  stop(): void;
  /** A fast, rising run for `days` days that were skipped at once (capped). */
  run(days: number): void;
}

/** Longest run, so a decade-long skip does not drone: the day count is shown as text instead. */
export const MAX_RUN_TICKS = 24;
const LOOKAHEAD = 0.25;
/** How far behind the audio clock a beat may fall before it is dropped. */
const LATE = 0.5;
const POLL_MS = 100;

/**
 * The steady tick while time runs in real time, plus the run for skipped time. Clicks are scheduled slightly ahead on
 * the audio clock so their spacing does not depend on frame timing. A muted ticker keeps its beat and still reports each
 * tick, so the visual cue works without sound.
 */
export function createTicker(options: TickerOptions): Ticker {
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let next: number | null = null;
  let count = 0;
  let holdUntil = 0;

  const emit = (at: number, pitch: number, gain: number) => {
    if (options.enabled()) options.sink.click(at, pitch, gain);
    options.onTick?.(count++);
  };

  const poll = () => {
    const now = options.sink.now();
    const interval = options.interval();
    if (!options.active() || interval === null || !(interval > 0) || now < holdUntil) {
      next = null;
    } else {
      next ??= Math.max(now, holdUntil) + interval;
      // After a stall (a hidden tab, a blocked thread) the beat is behind the clock. Those days were never simulated
      // (free-roam caps a frame at 250 ms), so the missed beats are dropped, not replayed as a burst.
      if (next < now - LATE) next = now + interval;
      while (next < now + LOOKAHEAD) {
        emit(next, 1, 0.5);
        next += interval;
      }
    }
    timer = setTimer(poll, POLL_MS);
  };

  return {
    start() {
      if (timer === null) poll();
    },
    stop() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      next = null;
    },
    run(days) {
      const n = Math.min(Math.max(Math.floor(days), 0), MAX_RUN_TICKS);
      if (n === 0) return;
      let at = options.sink.now();
      let gap = 0.14;
      for (let i = 0; i < n; i++) {
        emit(at, 1 + (0.8 * i) / Math.max(n - 1, 1), 0.45);
        at += gap;
        gap = Math.max(0.05, gap * 0.9);
      }
      holdUntil = at + 0.3; // the steady beat resumes after the run
      next = null;
    },
  };
}
