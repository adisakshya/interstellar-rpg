import { describe, expect, it } from "vitest";
import { createAdaptiveScaler } from "../../src/render";

const feed = (s: ReturnType<typeof createAdaptiveScaler>, ms: number, frames: number) => {
  let last: number | null = null;
  for (let i = 0; i < frames; i++) last = s.frame(ms) ?? last;
  return last;
};

describe("adaptive resolution (PERF-001)", () => {
  const opts = { min: 1, max: 2, window: 10 };

  it("lowers resolution (raises the scaling level) when frames run long, up to the maximum", () => {
    const s = createAdaptiveScaler(1, opts);
    expect(feed(s, 30, 10)).toBe(1.25);
    feed(s, 30, 40);
    expect(s.level).toBe(2);
    expect(feed(s, 30, 10)).toBeNull();
  });

  it("restores resolution when there is headroom, never past the tier's own level", () => {
    const s = createAdaptiveScaler(1.5, opts);
    expect(feed(s, 8, 10)).toBe(1.25);
    feed(s, 8, 30);
    expect(s.level).toBe(1);
  });

  it("holds steady in the middle band and ignores stalls", () => {
    const s = createAdaptiveScaler(1.5, opts);
    expect(feed(s, 18, 50)).toBeNull();
    expect(feed(s, 4000, 50)).toBeNull(); // a hidden tab or a scene load
    expect(s.level).toBe(1.5);
  });

  it("stops oscillating: a restore that turns out too slow is not tried again", () => {
    const s = createAdaptiveScaler(1.5, opts);
    feed(s, 8, 10); // fast → restore to 1.25
    expect(s.level).toBe(1.25);
    feed(s, 30, 10); // slow at 1.25 → back to 1.5, and 1.5 is now the finest level allowed
    expect(s.level).toBe(1.5);
    feed(s, 8, 100); // plenty of headroom, but 1.25 is known to be too costly
    expect(s.level).toBe(1.5);
  });
});
