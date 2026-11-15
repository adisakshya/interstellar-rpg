import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { FIXTURE_RATES, loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules, type CharacterId } from "../../src/domain";
import {
  createAudio,
  createTicker,
  DAY,
  MAX_RUN_TICKS,
  skippedDays,
  tickIntervalSeconds,
  type AudioContextLike,
  type ClickSink,
} from "../../src/audio";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const rates = episode.tables.rates;
const ROMILLY = "char.romilly" as CharacterId;
const fresh = () => createEngine(createInitialState(episode.initial), createRules(episode.tables));

describe("the tick's interval comes from the simulation (AUDIO-001)", () => {
  it("on Miller is within 1% of 86 400 s x r(Miller) / r(Endurance)", () => {
    const interval = tickIntervalSeconds(createInitialState(episode.initial), rates, ROMILLY)!;
    const expected = (DAY * FIXTURE_RATES["miller_surface"]!) / FIXTURE_RATES["endurance"]!;
    expect(Math.abs(interval - expected) / expected).toBeLessThan(0.01);
    expect(interval).toBeGreaterThan(1.4);
    expect(interval).toBeLessThan(1.46);
  });

  it("is silent while Romilly is controlled, or when a rate is unknown", () => {
    const game = fresh();
    game.dispatch({ kind: "SwitchCharacter", commandId: "sw", targetId: ROMILLY });
    expect(tickIntervalSeconds(game.getState(), rates, ROMILLY)).toBeNull();
    expect(tickIntervalSeconds(createInitialState(episode.initial), {}, ROMILLY)).toBeNull();
  });
});

describe("a skip of time is a run of days, free-roam is not", () => {
  it("counts the days that passed for Romilly during a scan, and ignores a 1 s tick or a switch", () => {
    const game = fresh();
    const before = game.getState();
    game.dispatch({ kind: "FreeRoamTick", commandId: "t1", actorId: "char.cooper" as never, dTau: 1 });
    expect(skippedDays(before, game.getState(), ROMILLY)).toBeNull();
    const mid = game.getState();
    game.dispatch({
      kind: "AdvanceTime",
      commandId: "s1",
      actorId: "char.cooper" as never,
      activityId: "scan.beacon",
      dTau: 600,
    });
    const days = skippedDays(mid, game.getState(), ROMILLY)!;
    expect(days).toBeGreaterThan(410); // 600 s on Miller is about 1.15 years for Romilly
    expect(days).toBeLessThan(430);
    const after = game.getState();
    game.dispatch({ kind: "SwitchCharacter", commandId: "sw", targetId: ROMILLY });
    expect(skippedDays(after, game.getState(), ROMILLY)).toBeNull();
  });
});

function harness(over: { interval?: () => number | null; active?: () => boolean; enabled?: () => boolean } = {}) {
  let now = 0;
  const clicks: { at: number; pitch: number }[] = [];
  const ticks: number[] = [];
  const timers: { run: () => void; live: boolean }[] = [];
  const sink: ClickSink = { now: () => now, click: (at, pitch) => clicks.push({ at, pitch }) };
  const ticker = createTicker({
    sink,
    interval: over.interval ?? (() => 1.5),
    active: over.active ?? (() => true),
    enabled: over.enabled ?? (() => true),
    onTick: (i) => ticks.push(i),
    setTimer: (run) => {
      const t = { run, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
  });
  const advance = (seconds: number) => {
    const end = now + seconds;
    while (now < end) {
      now = Math.min(end, now + 0.1);
      const t = timers.filter((x) => x.live).pop();
      if (t) {
        t.live = false;
        t.run();
      }
    }
  };
  return { ticker, clicks, ticks, advance };
}

describe("the ticker", () => {
  it("beats at the interval while the game runs, and not while it is held", () => {
    let active = true;
    const h = harness({ active: () => active });
    h.ticker.start();
    h.advance(10);
    const first = h.clicks.map((c) => c.at);
    expect(first.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < first.length; i++) expect(first[i]! - first[i - 1]!).toBeCloseTo(1.5, 5);
    active = false;
    const n = h.clicks.length;
    h.advance(10);
    expect(h.clicks.length).toBe(n);
  });

  it("keeps its beat and its visual cue when muted, but makes no sound", () => {
    const h = harness({ enabled: () => false });
    h.ticker.start();
    h.advance(6);
    expect(h.clicks).toHaveLength(0);
    expect(h.ticks.length).toBeGreaterThanOrEqual(3);
  });

  it("stays silent when the interval is null (Romilly is controlled)", () => {
    const h = harness({ interval: () => null });
    h.ticker.start();
    h.advance(10);
    expect(h.ticks).toHaveLength(0);
  });

  it("plays a fast rising run for skipped days, capped, then the steady beat resumes after it", () => {
    const h = harness();
    h.ticker.start();
    h.ticker.run(400);
    expect(h.clicks).toHaveLength(MAX_RUN_TICKS);
    const gaps = h.clicks.slice(1).map((c, i) => c.at - h.clicks[i]!.at);
    expect(gaps[0]!).toBeGreaterThan(gaps[gaps.length - 1]!); // it speeds up
    expect(h.clicks[MAX_RUN_TICKS - 1]!.pitch).toBeGreaterThan(h.clicks[0]!.pitch); // and rises
    const runEnd = h.clicks[MAX_RUN_TICKS - 1]!.at;
    h.advance(12);
    const later = h.clicks.slice(MAX_RUN_TICKS);
    expect(later.length).toBeGreaterThan(0);
    expect(later[0]!.at).toBeGreaterThan(runEnd + 1); // not on top of the run
  });
});

describe("the audio controller", () => {
  const fakeContext = () => {
    const calls: string[] = [];
    const param = () => ({
      value: 0,
      setValueAtTime: () => calls.push("gain"),
      exponentialRampToValueAtTime: () => undefined,
    });
    const ctx: AudioContextLike = {
      currentTime: 0,
      destination: {},
      sampleRate: 8000,
      createGain: () => ({ gain: param(), connect: () => undefined }),
      createOscillator: () => ({
        type: "",
        frequency: { value: 0 },
        connect: () => undefined,
        start: () => calls.push("osc"),
        stop: () => undefined,
      }),
      createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }),
      createBufferSource: () => ({ buffer: null, connect: () => undefined, start: () => calls.push("noise") }),
      createBiquadFilter: () => ({ type: "", frequency: { value: 0 }, Q: { value: 0 }, connect: () => undefined }),
    };
    return { ctx, calls };
  };

  it("plays the run for a skip once unlocked, reports the days, and remembers the mute choice", () => {
    const game = fresh();
    const { ctx, calls } = fakeContext();
    let stored = true;
    const skips: number[] = [];
    const audio = createAudio({
      getState: game.getState,
      rates,
      watcher: ROMILLY,
      active: () => false,
      onSkip: (d) => skips.push(d),
      preference: { get: () => stored, set: (v) => (stored = v) },
      createContext: () => ctx,
    });
    audio.unlock();
    game.subscribe((s) => audio.observe(s));
    game.dispatch({
      kind: "AdvanceTime",
      commandId: "s1",
      actorId: "char.cooper" as never,
      activityId: "scan.beacon",
      dTau: 600,
    });
    expect(skips).toHaveLength(1);
    expect(calls).toContain("osc");
    audio.setEnabled(false);
    expect(stored).toBe(false);
    audio.dispose();
  });

  it("survives a browser with no audio at all", () => {
    const game = fresh();
    const audio = createAudio({
      getState: game.getState,
      rates,
      watcher: ROMILLY,
      active: () => false,
      createContext: () => null,
    });
    expect(() => audio.unlock()).not.toThrow();
    audio.dispose();
  });
});
