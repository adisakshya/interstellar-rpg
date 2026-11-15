// Frame-time capture for the slice's two scenes (VALIDATION §3, QA-001).
//   npm run build && npx vite preview --port 4173 &   then   node scripts/frame-time.mjs [--url U] [--warmup 10] [--measure 60] [--out file.json] [--device iphone]
// For each scene it holds a movement key, waits out the warm-up, then records requestAnimationFrame deltas. Report the
// device, browser and tier with every number: a run in headless Chromium on software GL is *emulated* and says nothing
// about a phone (only physical runs count for NFR-02 and NFR-03 at M3).
import { writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg("url", "http://127.0.0.1:4173/interstellar-rpg/");
const warmup = Number(arg("warmup", 10));
const measure = Number(arg("measure", 60));
const out = arg("out", "");
const device = arg("device", "desktop");

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const summary = (deltas) => {
  const sorted = [...deltas].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
  return {
    frames: sorted.length,
    frameMs: { p50: pct(sorted, 50), p95: pct(sorted, 95), p99: pct(sorted, 99), mean },
    fps: { p50: 1000 / pct(sorted, 50), p95: 1000 / pct(sorted, 95) },
  };
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", ...(process.env.PW_NO_SANDBOX ? ["--no-sandbox"] : [])],
});
const context = await browser.newContext(
  device === "iphone"
    ? { ...devices["iPhone 13"], defaultBrowserType: "chromium" }
    : { viewport: { width: 1280, height: 720 } },
);
const page = await context.newPage();
await page.goto(`${url}?debug&frozen&fresh`);
await page.waitForSelector(".irpg-btn");

const capture = (seconds) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const end = last + ms;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve(deltas);
        };
        requestAnimationFrame(tick);
      }),
    seconds * 1000,
  );

async function scene(name) {
  await page.keyboard.down("KeyD"); // keep the character moving, as in a real run
  await capture(warmup);
  const deltas = await capture(measure);
  await page.keyboard.up("KeyD");
  return { scene: name, ...summary(deltas) };
}

const results = [];
results.push(await scene("surface (Cooper, Miller)"));
await page.getByRole("button", { name: /^Romilly/ }).click();
await page.waitForTimeout(1500); // the scene swap fades out and in
results.push(await scene("endurance (Romilly)"));

const info = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    userAgent: navigator.userAgent,
    devicePixelRatio,
    viewport: `${innerWidth}x${innerHeight}`,
    renderer: dbg && gl ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown",
    tier: window.__irpg.tier,
  };
});
const report = {
  label: "emulated: headless Chromium, software GL. Not a device measurement.",
  capturedAt: new Date().toISOString(),
  warmupSeconds: warmup,
  measureSeconds: measure,
  device,
  ...info,
  results,
};
const text = `${JSON.stringify(report, null, 2)}\n`;
if (out) writeFileSync(out, text);
else process.stdout.write(text);
await browser.close();
