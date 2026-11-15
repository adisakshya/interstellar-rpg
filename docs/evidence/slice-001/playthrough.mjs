// Plays the vertical slice twice in a real browser (both choices at the wave), on desktop with the keyboard and on
// a phone-sized touch viewport, checks the replay from a checkpoint, and saves screenshots.
// Needs `playwright`. Run: node playthrough.mjs <dist-dir> <out-dir>
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const { chromium, devices } = createRequire(import.meta.url)("playwright");
const [root, out] = process.argv.slice(2);
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  let p = path.join(root, decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/interstellar-rpg/, ""));
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    r.end(fs.readFileSync(p));
  } catch {
    r.writeHead(404).end();
  }
}).listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/interstellar-rpg/`;
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const result = {};
  const text = (pg, sel) => pg.locator(sel).first().innerText();
  const state = (pg) => pg.evaluate(() => { const s = window.__irpg.game.getState(); return { T: s.T, controlled: s.controlled, recall: s.decisions["decision.recall"] ?? null, doyle: s.characters["char.doyle"].unavailable, cooperTau: s.characters["char.cooper"].tau, romillyTau: s.characters["char.romilly"].tau, supplies: s.resources["res.endurance_supplies"].amount, knows: s.knowledge["char.cooper"] ?? [] }; });
  const outcome = (pg) => pg.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d && { rows: [...d.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent).join(" | ")), notes: [...d.querySelectorAll("li")].map((l) => l.textContent), buttons: [...d.querySelectorAll("button")].map((b) => b.textContent) }; });

  async function run(label, contextOptions, interact, shotPrefix) {
    const ctx = await browser.newContext(contextOptions);
    const pg = await ctx.newPage();
    const errors = [];
    pg.on("pageerror", (e) => errors.push(e.message));
    const r = { errors };
    await pg.goto(base + "?debug&fresh");
    await pg.waitForSelector(".irpg-btn");
    r.action1 = await text(pg, 'section[aria-labelledby="irpg-act-h"] button');
    await pg.screenshot({ path: `${out}/${shotPrefix}-1-start.png` });
    await interact(pg); // scan
    await interact(pg); // search → the wave
    await pg.waitForSelector(".irpg-prompt");
    r.prompt = { options: await pg.locator(".irpg-prompt button").allInnerTexts(), actionHidden: await pg.evaluate(() => document.querySelector('section[aria-labelledby="irpg-act-h"]').hidden) };
    await pg.screenshot({ path: `${out}/${shotPrefix}-2-wave.png` });
    return { pg, ctx, r };
  }

  const key = (pg) => pg.keyboard.press("KeyE").then(() => pg.waitForTimeout(250));
  const finish = async (pg, choice, shot) => {
    await pg.getByRole("button", { name: choice }).click();
    await pg.waitForTimeout(250);
    await pg.waitForSelector('section[aria-labelledby="irpg-act-h"]:not([hidden])');
    const before = await text(pg, 'section[aria-labelledby="irpg-act-h"] button');
    await pg.keyboard.press("KeyE"); // lift off
    await pg.waitForSelector('[role="dialog"]');
    await pg.screenshot({ path: `${out}/${shot}.png` });
    return { liftOffLabel: before, state: await state(pg), outcome: await outcome(pg) };
  };

  // Desktop, keyboard only: leave now.
  {
    const { pg, ctx, r } = await run("desktop-leave", { viewport: { width: 1280, height: 720 } }, key, "desktop");
    r.leave = await finish(pg, "Leave now", "desktop-3-outcome-leave");
    // Replay from the checkpoint at the wave and choose the other way.
    await pg.getByRole("button", { name: /Go back to "Recall"/ }).click();
    await pg.waitForSelector(".irpg-prompt");
    r.afterReplay = await state(pg);
    r.stay = await finish(pg, "Stay longer", "desktop-4-outcome-stay");
    result.desktop = r;
    await ctx.close();
  }
  // Phone, touch only: stay longer.
  {
    const iphone = devices["iPhone 13"];
    const tap = (pg) => pg.getByRole("button", { name: "Act", exact: true }).tap().then(() => pg.waitForTimeout(250));
    const { pg, ctx, r } = await run("phone-stay", { ...iphone }, tap, "phone");
    await pg.getByRole("button", { name: "Stay longer" }).tap();
    await pg.waitForTimeout(250);
    await pg.getByRole("button", { name: "Act", exact: true }).tap();
    await pg.waitForSelector('[role="dialog"]');
    await pg.screenshot({ path: `${out}/phone-3-outcome-stay.png` });
    r.stay = { state: await state(pg), outcome: await outcome(pg) };
    result.phone = r;
    await ctx.close();
  }
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
  srv.close();
});
