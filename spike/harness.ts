import { createSpikeScene, type SpikeOptions } from "./scene";

/** Results the page exposes for the Playwright script, and shows on screen for a phone run. */
export interface SpikeResult {
  view: string;
  scaling: number;
  devicePixelRatio: number;
  canvas: { width: number; height: number };
  userAgent: string;
  renderer: string;
  frames: number;
  frameMs: { p50: number; p95: number; p99: number; mean: number };
  fps: { p50: number; p95: number };
  inputLatencyMs: number[];
  heapMB: number | null;
  firstFrameMs: number;
}

declare global {
  interface Window {
    __spike?: SpikeResult;
  }
}

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;

export function runSpike(): void {
  const params = new URLSearchParams(location.search);
  const options: SpikeOptions = {
    view: params.get("view") === "cockpit" ? "cockpit" : "surface",
    scaling: Number(params.get("scaling") ?? (devicePixelRatio > 2 ? 1.5 : 1)),
  };
  const warmupMs = Number(params.get("warmup") ?? 10000);
  const measureMs = Number(params.get("measure") ?? 60000);

  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const hud = document.getElementById("hud")!;
  const pad = document.getElementById("pad")!;
  const spike = createSpikeScene(canvas, options);
  const { engine, scene } = spike;

  // Touch joystick: a fixed pad; the offset from its centre is the stick.
  let pendingInputAt: number | null = null;
  let releaseAfterNextFrame = false;
  let appliedThisFrame = false;
  const latencies: number[] = [];
  const setStick = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    spike.input.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    spike.input.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
  };
  pad.addEventListener("pointerdown", (e) => {
    pad.setPointerCapture(e.pointerId);
    pendingInputAt = e.timeStamp;
    setStick(e);
  });
  pad.addEventListener("pointermove", (e) => {
    if (e.buttons) setStick(e);
  });
  // A quick tap may lift before any frame ran; keep the stick until one frame has used it.
  const release = () => {
    releaseAfterNextFrame = true;
  };
  pad.addEventListener("pointerup", release);
  pad.addEventListener("pointercancel", release);

  const start = performance.now();
  let firstFrameMs = -1;
  let last = start;
  const deltas: number[] = [];
  // Move before rendering, so the frame that follows the input already shows it.
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const moved = spike.step(Math.min((now - last) / 1000, 0.1));
    appliedThisFrame = moved && pendingInputAt !== null;
    if (releaseAfterNextFrame) {
      spike.input.x = 0;
      spike.input.y = 0;
      releaseAfterNextFrame = false;
    }
  });
  scene.onAfterRenderObservable.add(() => {
    const now = performance.now();
    if (firstFrameMs < 0) firstFrameMs = now - start;
    const dt = (now - last) / 1000;
    last = now;
    if (appliedThisFrame && pendingInputAt !== null) {
      // Input event → end of the frame that shows it (CPU side; display scan-out adds up to one refresh).
      latencies.push(now - pendingInputAt);
      pendingInputAt = null;
      appliedThisFrame = false;
    }
    const t = now - start;
    if (t > warmupMs && t <= warmupMs + measureMs) deltas.push(dt * 1000);
    // Once the result exists, leave the JSON on screen so it can be read and screenshotted on the phone.
    if (window.__spike) return;
    if (t > warmupMs + measureMs) finish();
    else if (Math.floor(t / 500) !== Math.floor((t - dt * 1000) / 500)) {
      hud.textContent = `${options.view} · ${t < warmupMs ? "warming up" : "measuring"} · ${(1 / Math.max(dt, 1e-3)).toFixed(0)} fps`;
    }
  });

  function finish(): void {
    const sorted = [...deltas].sort((a, b) => a - b);
    const gl = engine._gl as WebGLRenderingContext | null;
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    window.__spike = {
      view: options.view,
      scaling: options.scaling,
      devicePixelRatio,
      canvas: { width: engine.getRenderWidth(), height: engine.getRenderHeight() },
      userAgent: navigator.userAgent,
      renderer:
        dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : (engine.getGlInfo().renderer ?? "unknown"),
      frames: sorted.length,
      frameMs: {
        p50: pct(sorted, 50),
        p95: pct(sorted, 95),
        p99: pct(sorted, 99),
        mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length),
      },
      fps: { p50: 1000 / pct(sorted, 50), p95: 1000 / pct(sorted, 95) },
      inputLatencyMs: latencies,
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
      firstFrameMs,
    };
    hud.textContent = JSON.stringify(window.__spike, null, 1);
    hud.style.whiteSpace = "pre-wrap";
    hud.style.fontSize = "11px";
    hud.style.pointerEvents = "auto";
  }

  engine.runRenderLoop(() => scene.render());
  addEventListener("resize", () => engine.resize());
}
