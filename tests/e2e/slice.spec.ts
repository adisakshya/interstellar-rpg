import { readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

// QA-001: walkthroughs W1, W2, W4 and W6 (TIMELINES §11) in a real browser. The desktop project drives the game with
// the keyboard; the mobile project is Chromium *emulating* an iPhone and drives it by touch. Real-time free-roam is
// frozen (`?debug&frozen`) so every run issues exactly the same commands, which is what makes the final state hashes comparable.

type Step = "interact" | { decision: string; option: string; label: string };
const golden = JSON.parse(readFileSync(new URL("../golden/slice.json", import.meta.url), "utf8")) as {
  paths: Record<string, { steps: Step[]; hash: string }>;
};

interface Probe {
  game: {
    getState(): {
      T: number;
      controlled: string;
      characters: Record<string, { unavailable: string | null; tau: number }>;
      knowledge: Record<string, string[]>;
      playerSeen: string[];
      decisions: Record<string, { status: string; optionId: string | null }>;
      resources: Record<string, { amount: number }>;
    };
    dispatch(command: unknown): { kind: string; code?: string };
  };
  freeRoam: { setPaused(paused: boolean): void };
  hash(): Promise<string>;
  flushSave(): Promise<void>;
  goToObjective(): void;
  renderer: { handle: { position?(): unknown } | null };
  slots: {
    listCheckpoints(): Promise<{ key: string }[]>;
    restoreCheckpoint(key: string): Promise<unknown>;
  };
}
declare global {
  interface Window {
    __irpg: Probe;
  }
}

const touch = (info: TestInfo) => info.project.name.startsWith("mobile");

async function start(page: Page): Promise<void> {
  await page.goto("./?debug&frozen&fresh");
  await page.waitForSelector(".irpg-btn");
  // The surface scene loads after the HUD; actions tied to a landmark are refused until it reports where Cooper stands.
  await page.waitForFunction(() => window.__irpg.renderer.handle?.position?.() != null);
}

async function interact(page: Page, info: TestInfo): Promise<void> {
  // Actions tied to a landmark need the player to be there (PLAY-001); the script walks there in one step.
  await page.evaluate(() => window.__irpg.goToObjective());
  await page.waitForTimeout(150);
  if (touch(info)) await page.getByRole("button", { name: "Act", exact: true }).tap();
  else await page.keyboard.press("KeyE");
}

async function choose(page: Page, info: TestInfo, label: string): Promise<void> {
  const button = page.getByRole("button", { name: label, exact: true });
  if (touch(info)) await button.tap();
  else await button.click();
}

/** Play steps with the project's input method. Commands run synchronously, so a short pause lets the UI settle. */
async function play(page: Page, info: TestInfo, steps: readonly Step[]): Promise<void> {
  for (const step of steps) {
    if (step === "interact") await interact(page, info);
    else await choose(page, info, step.label);
    await page.waitForTimeout(150);
  }
}

for (const [name, path] of Object.entries(golden.paths)) {
  test(`W6: ${name} reaches the recorded state hash, with the same outcome on every input method`, async ({
    page,
  }, info) => {
    await start(page);
    await play(page, info, path.steps);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.evaluate(() => window.__irpg.hash())).toBe(path.hash);
  });
}

test("W1: extra time on the planet changes Romilly's state and supplies", async ({ page }, info) => {
  const outcome = async (name: string) => {
    await start(page);
    await play(page, info, golden.paths[name]!.steps);
    return page.evaluate(() => {
      const s = window.__irpg.game.getState();
      return {
        years: s.characters["char.romilly"]!.tau / (365.25 * 86400),
        supplies: s.resources["res.endurance_supplies"]!.amount,
      };
    });
  };
  const leave = await outcome("leave_now");
  const stay = await outcome("stay_longer");
  // Same lift-off, but the hour spent recovering the recorder cost Romilly about 7.5 years and 7.5 units of supplies.
  expect(stay.years - leave.years).toBeGreaterThan(7);
  expect(stay.years - leave.years).toBeLessThan(8);
  expect(leave.supplies - stay.supplies).toBeGreaterThan(7);
});

test("W2: switching cannot dodge costs or leak facts", async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__irpg.goToObjective()); // the scan needs Cooper at the beacon (PLAY-001)
  await page.keyboard.press("KeyE"); // Cooper scans the beacon
  const result = await page.evaluate(async () => {
    const { game, hash } = window.__irpg;
    const withoutControl = async () => {
      const s = game.getState();
      return JSON.stringify({ ...s, controlled: "", processedCommandIds: [], seq: 0 });
    };
    const before = await withoutControl();
    const T = game.getState().T;
    for (let i = 0; i < 100; i++) {
      game.dispatch({ kind: "SwitchCharacter", commandId: `w2-a-${i}`, targetId: "char.romilly" });
      game.dispatch({ kind: "SwitchCharacter", commandId: `w2-b-${i}`, targetId: "char.cooper" });
    }
    const s = game.getState();
    return {
      unchanged: before === (await withoutControl()),
      sameTime: s.T === T,
      controlled: s.controlled,
      cooperKnows: s.knowledge["char.cooper"] ?? [],
      romillyKnows: s.knowledge["char.romilly"] ?? [],
      playerSeen: s.playerSeen,
      hashType: typeof (await hash()),
    };
  });
  expect(result.unchanged).toBe(true);
  expect(result.sameTime).toBe(true);
  expect(result.controlled).toBe("char.cooper");
  expect(result.cooperKnows).toContain("fact.beacon_local_age");
  expect(result.playerSeen).toContain("fact.beacon_local_age");
  expect(result.romillyKnows).not.toContain("fact.beacon_local_age");
});

test("W4: reload at a pending decision keeps it pending; it resolves once; a checkpoint brings it back", async ({
  page,
}, info) => {
  await start(page);
  await play(page, info, golden.paths["leave_now"]!.steps.slice(0, 2)); // scan, search: the wave warning is pending
  const pending = await page.evaluate(() => window.__irpg.game.getState().decisions["decision.recall"]?.status);
  expect(pending).toBe("pending");
  const before = await page.evaluate(() => window.__irpg.hash());
  await page.evaluate(() => window.__irpg.flushSave()); // write the owed autosave now instead of guessing the debounce
  await page.goto("./?debug&frozen"); // a plain reload resumes the saved game
  await page.waitForSelector(".irpg-prompt");
  expect(await page.evaluate(() => window.__irpg.hash())).toBe(before);
  expect(await page.evaluate(() => window.__irpg.game.getState().decisions["decision.recall"]?.status)).toBe("pending");

  const results = await page.evaluate(() => {
    const { game } = window.__irpg;
    const resolve = (commandId: string, optionId: string) =>
      game.dispatch({ kind: "ResolveDecision", commandId, decisionId: "decision.recall", optionId });
    return [resolve("cmd-77", "leave_now").kind, resolve("cmd-77", "leave_now").kind, resolve("cmd-78", "stay_longer")];
  });
  expect(results[0]).toBe("Ok");
  expect(results[1]).toBe("Duplicate");
  expect(results[2]).toEqual({ kind: "Rejected", code: "DECISION_ALREADY_RESOLVED" });

  // The checkpoint taken when the warning became pending still has it pending, so the other choice can be tried. Let the
  // autosave of the resolved game land first (about 2 s after the last commit), so it cannot overwrite the restore. The
  // app's own replay button guards against that race; this test calls the slots directly.
  await page.evaluate(() => window.__irpg.flushSave());
  const keys = await page.evaluate(async () => (await window.__irpg.slots.listCheckpoints()).map((c) => c.key));
  expect(keys).toHaveLength(1);
  await page.evaluate(async (key) => {
    await window.__irpg.slots.restoreCheckpoint(key);
  }, keys[0]!);
  await page.goto("./?debug&frozen");
  await page.waitForSelector(".irpg-prompt");
  expect(await page.evaluate(() => window.__irpg.game.getState().decisions["decision.recall"]?.status)).toBe("pending");
});
