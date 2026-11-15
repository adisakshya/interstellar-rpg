import { describe, expect, it } from "vitest";
import { WAVE_FAR, WAVE_HEIGHT_ARRIVAL, WAVE_NEAR, WAVE_PASSING, waveAt, waveScheduleOf } from "../../src/render/wave";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";

const S = { warnT: 1000, arriveT: 2000 };

describe("the wave on the timeline (WAVE-001, FR-23)", () => {
  it("is not there before the warning, and rises on the horizon at the warning", () => {
    expect(waveAt(999, S).phase).toBe("none");
    const at = waveAt(1000, S);
    expect(at.phase).toBe("approach");
    expect(at.distance).toBeCloseTo(WAVE_FAR, 6);
  });

  it("arrives exactly at the deadline: nearest and tallest at T = arriveT", () => {
    const at = waveAt(2000, S);
    expect(at.phase).toBe("approach");
    expect(at.progress).toBe(1);
    expect(at.distance).toBeCloseTo(WAVE_NEAR, 6);
    expect(at.height).toBeCloseTo(WAVE_HEIGHT_ARRIVAL, 6);
  });

  it("only ever comes closer and taller between the warning and the arrival", () => {
    let last = waveAt(1000, S);
    for (let T = 1010; T <= 2000; T += 10) {
      const w = waveAt(T, S);
      expect(w.distance).toBeLessThanOrEqual(last.distance + 1e-9);
      expect(w.height).toBeGreaterThanOrEqual(last.height - 1e-9);
      last = w;
    }
  });

  it("passes over and is gone, fading as it goes", () => {
    const mid = waveAt(2000 + 1000 * WAVE_PASSING * 0.5, S);
    expect(mid.phase).toBe("passing");
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.distance).toBeLessThan(WAVE_NEAR);
    expect(waveAt(2000 + 1000 * WAVE_PASSING + 1, S).phase).toBe("none");
    expect(waveAt(9e9, S).phase).toBe("none");
  });

  it("has no schedule for a story with no hazard, or one whose decision has no fixed times", () => {
    expect(waveScheduleOf({})).toBeNull();
    expect(
      waveScheduleOf({
        hazards: [{ id: "h", atDeadlineOf: "decision.x" as never, whenOption: "o", effects: [] }],
        decisions: {},
      }),
    ).toBeNull();
  });

  it("ignores a schedule that does not run forward", () => {
    expect(waveAt(5, { warnT: 10, arriveT: 10 }).phase).toBe("none");
    expect(waveAt(5, { warnT: 10, arriveT: 4 }).phase).toBe("none");
  });

  it("matches the content: the warning is when the recall decision opens and the arrival is its hard deadline", () => {
    const out = loadEpisode(m1);
    if (!out.ok) throw new Error(out.errors.join("\n"));
    const schedule = waveScheduleOf(out.episode.tables)!;
    const decision = out.episode.tables.decisions!["decision.recall" as never]!;
    expect(schedule).toEqual({ warnT: decision.triggerT, arriveT: decision.deadlineT });
    expect(waveAt(schedule.warnT, schedule).phase).toBe("approach");
    expect(waveAt(schedule.arriveT, schedule).distance).toBeCloseTo(WAVE_NEAR, 6);
  });
});
