import type { TimeTables } from "../domain";

/**
 * The tidal wave as a visible event (WAVE-001, FR-23). Pure: given reference time and the wave's schedule it says how far
 * along the wave is and what it should look like. The schedule comes from content (the warning is when the decision
 * opens, the arrival is its hard deadline), so the wave reaches the player exactly when the rules say it does and is
 * never a cut.
 */
export interface WaveSchedule {
  /** Reference time at which the wave is first seen on the horizon (the warning). */
  readonly warnT: number;
  /** Reference time at which it arrives (the decision's hard deadline). */
  readonly arriveT: number;
}

/**
 * The wave's schedule from content: the first hazard's decision opens at the warning (`triggerT`) and has its hard
 * deadline at the arrival (`deadlineT`). Null if the story has no such hazard or its times are not fixed numbers.
 */
export function waveScheduleOf(tables: Pick<TimeTables, "hazards" | "decisions">): WaveSchedule | null {
  const hazard = tables.hazards?.[0];
  const decision = hazard ? tables.decisions?.[hazard.atDeadlineOf] : undefined;
  if (!decision || decision.triggerT === undefined || decision.deadlineT === null) return null;
  return { warnT: decision.triggerT, arriveT: decision.deadlineT };
}

export interface WaveLook {
  /** "none" before the warning and after the wave has passed. */
  readonly phase: "none" | "approach" | "passing";
  /** 0 at the warning, 1 at the arrival; beyond 1 while it passes. */
  readonly progress: number;
  /** Distance from the player in metres (the horizon is about 170). */
  readonly distance: number;
  /** Height of the crest in metres. */
  readonly height: number;
  /** 1 fully visible, fading to 0 as it passes. */
  readonly opacity: number;
}

export const WAVE_FAR = 170;
export const WAVE_NEAR = 14;
export const WAVE_HEIGHT_START = 5;
export const WAVE_HEIGHT_ARRIVAL = 38;
/** How long the wave takes to pass over, as a fraction of the warning-to-arrival time. */
export const WAVE_PASSING = 0.12;

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Progress of the wave at reference time T: 0 at the warning, 1 at the arrival; null for a schedule that does not run forward. */
export function waveProgress(T: number, s: WaveSchedule): number | null {
  const span = s.arriveT - s.warnT;
  return span > 0 ? (T - s.warnT) / span : null;
}

export function waveAt(T: number, s: WaveSchedule): WaveLook {
  const p = waveProgress(T, s);
  return p === null ? { phase: "none", progress: 0, distance: WAVE_FAR, height: 0, opacity: 0 } : waveLook(p);
}

/** What the wave looks like at a given progress. Scenes smooth the progress between game ticks, then call this. */
export function waveLook(p: number): WaveLook {
  if (p < 0 || p > 1 + WAVE_PASSING) return { phase: "none", progress: p, distance: WAVE_FAR, height: 0, opacity: 0 };
  if (p <= 1) {
    // Slow at first, then faster as it nears: a wall that seems to hang on the horizon, then is suddenly upon you.
    const e = ease(clamp01(p)) * 0.55 + clamp01(p) ** 3 * 0.45;
    return {
      phase: "approach",
      progress: p,
      distance: WAVE_FAR + (WAVE_NEAR - WAVE_FAR) * e,
      height: WAVE_HEIGHT_START + (WAVE_HEIGHT_ARRIVAL - WAVE_HEIGHT_START) * e,
      opacity: 1,
    };
  }
  const q = (p - 1) / WAVE_PASSING; // 0..1 while passing
  return {
    phase: "passing",
    progress: p,
    distance: WAVE_NEAR - q * (WAVE_NEAR + 40),
    height: WAVE_HEIGHT_ARRIVAL,
    opacity: 1 - q,
  };
}
