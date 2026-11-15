// SPIKE-001 measurement: bundle sizes (deep imports vs whole @babylonjs/core) and emulated frame times.
// Usage: node spike/measure.mjs [--measure=60000] [--warmup=10000] [--out=docs/spikes/SPIKE-001.raw.json]
// Emulated numbers come from headless Chromium with software WebGL; they are NOT phone numbers (VALIDATION §1).
import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { build } from "vite";
import { createRequire } from "node:module";

// Playwright is not a project dependency yet (QA-001 adds it); resolve a global install via NODE_PATH.
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const measure = Number(arg("measure", 60000));
const warmup = Number(arg("warmup", 10000));
const outFile = arg("out", "docs/spikes/SPIKE-001.raw.json");
const root = resolve(".");

async function bundle(name, input) {
  const outDir = join(root, ".spike-out", name);
  await build({
    root,
    configFile: false,
    logLevel: "warn",
    base: "/",
    build: { outDir, emptyOutDir: true, target: "es2022", rollupOptions: { input: join(root, input) } },
  });
  const files = [];
  const walk = (d) =>
    readdirSync(d).forEach((f) => {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (!p.endsWith(".map")) files.push(p);
    });
  walk(outDir);
  let raw = 0,
    gzip = 0,
    brotli = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    raw += buf.length;
    gzip += gzipSync(buf, { level: 9 }).length;
    brotli += brotliCompressSync(buf).length;
  }
  return { outDir, files: files.length, bytes: { raw, gzip, brotli } };
}

function serve(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = join(dir, path);
    try {
      if (statSync(file).isDirectory()) file = join(file, "index.html");
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function run(browser, base, profile, view) {
  const context = await browser.newContext(profile.context);
  const page = await context.newPage();
  const url = `${base}${profile.path}?view=${view}&warmup=${warmup}&measure=${measure}${profile.query ?? ""}`;
  await page.goto(url);
  if (profile.context.hasTouch) {
    // Ten joystick taps during measurement to time input → next rendered frame.
    await page.waitForTimeout(warmup + 2000);
    const box = await page.locator("#pad").boundingBox();
    for (let i = 0; i < 10; i++) {
      await page.touchscreen.tap(box.x + box.width * 0.9, box.y + box.height / 2);
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForFunction(() => window.__spike !== undefined, null, { timeout: warmup + measure + 60000 });
  const result = await page.evaluate(() => window.__spike);
  await context.close();
  return { profile: profile.name, view, ...result };
}

const tree = await bundle("tree", "spike/index.html");
const full = await bundle("full", "spike/full/index.html");
console.log("bundles", { tree: tree.bytes, full: full.bytes });

const server = await serve(tree.outDir);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const iphone = devices["iPhone 15"] ?? devices["iPhone 14"];
const profiles = [
  { name: "desktop-chromium-headless", path: "/spike/", context: { viewport: { width: 1280, height: 800 } } },
  {
    name: "iphone15-viewport-chromium-headless",
    path: "/spike/",
    query: "&scaling=1.5",
    context: { ...iphone, defaultBrowserType: undefined },
  },
];
const runs = [];
for (const profile of profiles)
  for (const view of ["surface", "cockpit"]) {
    const r = await run(browser, base, profile, view);
    console.log(
      r.profile,
      r.view,
      r.frameMs,
      r.inputLatencyMs.length ? `latency ${r.inputLatencyMs.map((x) => x.toFixed(1)).join(",")}` : "",
    );
    runs.push(r);
  }
await browser.close();
server.close();

const report = {
  generatedBy: "spike/measure.mjs",
  emulated: true,
  conditions: {
    warmupMs: warmup,
    measureMs: measure,
    node: process.version,
    browser: "Chromium (Playwright 1.56), headless, software WebGL",
  },
  bundles: { tree: tree.bytes, full: full.bytes },
  runs,
};
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
console.log(`wrote ${outFile}`);
