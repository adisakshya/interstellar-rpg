const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = process.argv[2];
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  let p = path.join(root, decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/interstellar-rpg/, ""));
  try { if (fs.statSync(p).isDirectory()) p = path.join(p, "index.html"); r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); r.end(fs.readFileSync(p)); } catch { r.writeHead(404).end(); }
}).listen(0, async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const pg = await ctx.newPage();
  const logs = []; pg.on("console", (m) => logs.push(m.type() + ": " + m.text())); pg.on("pageerror", (e) => logs.push("ERR " + e.message));
  const base = `http://127.0.0.1:${srv.address().port}/interstellar-rpg/`;
  const T = () => pg.evaluate(() => window.__irpg.game.getState().T);
  const sleep = (ms) => pg.waitForTimeout(ms);
  const out = {};
  await pg.goto(base + "?debug&fresh"); await pg.waitForSelector(".irpg-btn"); await sleep(500);
  const t0 = await T(); await sleep(3600); const t1 = await T();
  out.running = { t0, t1, advanced: t1 > t0 };
  const setVis = (v) => pg.evaluate((v) => { Object.defineProperty(document, "visibilityState", { value: v, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }, v);
  await setVis("hidden"); await sleep(200);
  const h0 = await T(); await sleep(3500); const h1 = await T();
  out.hidden = { h0, h1, frozen: h0 === h1, pausedShown: await pg.evaluate(() => { const e = document.querySelector(".irpg-paused"); return e && !e.hidden && e.textContent; }) };
  out.autosave = await pg.evaluate(async () => { const t = await window.__irpg.slots.exportSlot("autosave"); return t ? { bytes: t.length, T: JSON.parse(t).state.T } : null; });
  await setVis("visible"); await sleep(1500); const v1 = await T();
  out.visible = { v1, resumed: v1 > h1, pausedHidden: await pg.evaluate(() => document.querySelector(".irpg-paused").hidden) };
  // context loss
  const scene0 = await pg.evaluate(() => window.__irpg.renderer.handle.scene.uid);
  await pg.evaluate(() => { const gl = document.getElementById("game").getContext("webgl2") || document.getElementById("game").getContext("webgl"); window.__ext = gl.getExtension("WEBGL_lose_context"); window.__ext.loseContext(); });
  await sleep(300); const c0 = await T(); await sleep(3000); const c1 = await T();
  out.contextLost = { frozen: c0 === c1, pausedShown: await pg.evaluate(() => !document.querySelector(".irpg-paused").hidden) };
  await pg.evaluate(() => window.__ext.restoreContext()); await sleep(2500);
  const c2 = await T(); await sleep(1500); const c3 = await T();
  out.contextRestored = { current: await pg.evaluate(() => window.__irpg.renderer.current), newScene: (await pg.evaluate(() => window.__irpg.renderer.handle.scene.uid)) !== scene0, advancing: c3 > c2, pausedHidden: await pg.evaluate(() => document.querySelector(".irpg-paused").hidden) };
  await pg.screenshot({ path: process.argv[3] + "/after-restore.png" });
  const pixels = await pg.evaluate(() => { const c = document.createElement("canvas"); return null; });
  // reload resumes from autosave
  await setVis("hidden"); await sleep(300);
  const savedT = await T();
  await pg.goto(base + "?debug"); await pg.waitForSelector(".irpg-btn"); await sleep(300);
  const r0 = await pg.evaluate(() => window.__irpg.game.getState().T);
  out.reload = { savedT, resumedT: r0, resumed: r0 >= savedT - 1 && r0 > 0 };
  out.logs = logs.filter((l) => !/GPU stall|swiftshader|WebGL: /i.test(l));
  console.log(JSON.stringify(out, null, 1));
  await b.close(); srv.close();
});
