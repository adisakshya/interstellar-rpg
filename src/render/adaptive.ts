/**
 * Adaptive resolution (PERF-001). Render at a lower resolution when frames run long, and recover resolution when
 * there is headroom. Pure: the caller feeds frame times and applies the returned level.
 */
export interface AdaptiveOptions {
  /** Hardware scaling levels: higher means fewer pixels. */
  readonly min: number;
  readonly max: number;
  /** Frames per decision window. */
  readonly window?: number;
  /** Average frame time above which we reduce resolution (ms). Default 22 ≈ below 45 fps. */
  readonly slowMs?: number;
  /** Average frame time below which we may restore resolution (ms). Default 14 ≈ above 70 fps. */
  readonly fastMs?: number;
  readonly step?: number;
}

export interface AdaptiveScaler {
  /** Report one frame's duration; returns the new level when it changes, otherwise null. */
  frame(ms: number): number | null;
  readonly level: number;
}

export function createAdaptiveScaler(start: number, options: AdaptiveOptions): AdaptiveScaler {
  const window = options.window ?? 60;
  const slow = options.slowMs ?? 22;
  const fast = options.fastMs ?? 14;
  const step = options.step ?? 0.25;
  let level = Math.min(options.max, Math.max(options.min, start));
  /** The sharpest (lowest) level still allowed. Rises when a restore proves too costly, so we stop oscillating. */
  let finest = options.min;
  let justRestored = false;
  let sum = 0;
  let n = 0;
  return {
    frame(ms) {
      // Ignore stalls from a hidden tab or a long scene load: they say nothing about steady rendering cost.
      if (!Number.isFinite(ms) || ms <= 0 || ms > 250) return null;
      sum += ms;
      n++;
      if (n < window) return null;
      const mean = sum / n;
      sum = 0;
      n = 0;
      let next = level;
      if (mean > slow) {
        // Slow straight after we restored resolution: the lower level was only fast because it drew fewer pixels.
        // Remember the level we came from so the scaler does not oscillate between the two.
        if (justRestored) finest = Math.max(finest, level + step);
        next = Math.min(options.max, level + step);
        justRestored = false;
      } else if (mean < fast) {
        next = Math.max(options.min, finest > level - step ? level : level - step);
        justRestored = next !== level;
      } else {
        justRestored = false;
      }
      if (next === level) return null;
      level = next;
      return level;
    },
    get level() {
      return level;
    },
  };
}
