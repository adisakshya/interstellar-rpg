import type { ClickSink } from "./tick";

/** The subset of the Web Audio API the click needs, so tests can stand in for it. */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly sampleRate: number;
  createGain(): { gain: AudioParamLike; connect(node: unknown): void };
  createOscillator(): {
    type: string;
    frequency: { value: number };
    connect(node: unknown): void;
    start(at: number): void;
    stop(at: number): void;
  };
  createBuffer(channels: number, length: number, rate: number): { getChannelData(c: number): Float32Array };
  createBufferSource(): { buffer: unknown; connect(node: unknown): void; start(at: number): void };
  createBiquadFilter(): {
    type: string;
    frequency: { value: number };
    Q: { value: number };
    connect(node: unknown): void;
  };
}
interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
}

/**
 * The tick, made in code (D-17: no recorded or generated assets): a soft wooden click, a short noise burst through a
 * band-pass plus a quickly fading sine, about 60 ms long. Original to this project.
 */
export function createClickSink(ctx: AudioContextLike): ClickSink {
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.012), ctx.sampleRate);
  const data = noise.getChannelData(0);
  // A fixed pseudo-random sequence, so every click is the same click.
  let seed = 12345;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = ((seed / 0xffffffff) * 2 - 1) * (1 - i / data.length);
  }
  // Every click goes through one master gain, so muting silences clicks that are already queued, such as the rest of a run.
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  return {
    now: () => ctx.currentTime,
    mute(muted) {
      master.gain.value = muted ? 0 : 1;
    },
    click(at, pitch, gain) {
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, at);
      out.gain.exponentialRampToValueAtTime(Math.max(gain, 0.001) * 0.35, at + 0.003);
      out.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      out.connect(master);

      const tone = ctx.createOscillator();
      tone.type = "sine";
      tone.frequency.value = 820 * pitch;
      tone.connect(out);
      tone.start(at);
      tone.stop(at + 0.08);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2600 * pitch;
      filter.Q.value = 1.4;
      filter.connect(out);
      const burst = ctx.createBufferSource();
      burst.buffer = noise;
      burst.connect(filter);
      burst.start(at);
    },
  };
}
