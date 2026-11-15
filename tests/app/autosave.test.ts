import { describe, expect, it, vi } from "vitest";
import { createAutosaver } from "../../src/app/autosave";

function setup(save: () => Promise<void> | void = () => undefined) {
  let now = 0;
  const timers: Array<{ at: number; run: () => void; id: number; live: boolean }> = [];
  const saved = vi.fn(save);
  const onError = vi.fn();
  const saver = createAutosaver({
    save: saved,
    delayMs: 2000,
    onError,
    setTimer: (run, ms) => {
      const t = { at: now + ms, run, id: timers.length, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
  });
  const advance = async (ms: number) => {
    now += ms;
    for (const t of timers) {
      if (t.live && t.at <= now) {
        t.live = false;
        t.run();
      }
    }
    await Promise.resolve();
    await Promise.resolve();
  };
  return { saver, saved, onError, advance };
}

describe("autosave after committed commands (TIMELINES §8)", () => {
  it("saves about 2 s after a change, once for a burst", async () => {
    const t = setup();
    t.saver.changed();
    t.saver.changed();
    await t.advance(1999);
    expect(t.saved).not.toHaveBeenCalled();
    await t.advance(1);
    expect(t.saved).toHaveBeenCalledTimes(1);
    await t.advance(10_000);
    expect(t.saved).toHaveBeenCalledTimes(1); // nothing new to save
  });

  it("still saves while changes keep arriving every second (free-roam), instead of being pushed back forever", async () => {
    const t = setup();
    for (let i = 0; i < 6; i++) {
      t.saver.changed();
      await t.advance(1000);
    }
    expect(t.saved.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("flush saves immediately when something is unsaved, and cancels the timer", async () => {
    const t = setup();
    t.saver.changed();
    await t.saver.flush();
    expect(t.saved).toHaveBeenCalledTimes(1);
    await t.advance(5000);
    expect(t.saved).toHaveBeenCalledTimes(1);
    await t.saver.flush(); // clean: no write
    expect(t.saved).toHaveBeenCalledTimes(1);
  });

  it("never runs two writes at once: a flush during a slow timed write waits for it, so the newer state lands last", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    let first = true;
    const t = setup(() => {
      const label = first ? "timed" : "flush";
      first = false;
      order.push(`${label} start`);
      if (label === "timed") {
        return new Promise<void>((resolve) => {
          release = () => {
            order.push("timed end");
            resolve();
          };
        });
      }
      order.push("flush end");
    });
    t.saver.changed();
    await t.advance(2000); // the timed write starts and stays in flight
    t.saver.changed(); // a newer state is owed
    const flushed = t.saver.flush();
    await Promise.resolve();
    expect(order).toEqual(["timed start"]); // the flush has not started its own write yet
    release();
    await flushed;
    expect(order).toEqual(["timed start", "timed end", "flush start", "flush end"]);
  });

  it("reports a failed save and tries again on the next change", async () => {
    let fail = true;
    const t = setup(() => {
      if (fail) throw new Error("quota");
    });
    t.saver.changed();
    await t.advance(2000);
    expect(t.onError).toHaveBeenCalledTimes(1);
    fail = false;
    await t.saver.flush();
    expect(t.saved).toHaveBeenCalledTimes(2);
  });
});
