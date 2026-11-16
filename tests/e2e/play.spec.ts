import { expect, test } from "@playwright/test";

/** The test hook, read inside the page (the full typing lives in slice.spec.ts). */
declare const window: {
  __irpg: {
    game: { getState(): { T: number } };
    goToObjective(): void;
    renderer: { handle: { position?(): unknown } | null };
  };
};

test("you have to walk to the beacon to scan it, and the HUD says where it is", async ({ page }, info) => {
  await page.goto("./?debug&frozen&fresh");
  await page.waitForSelector(".irpg-btn");
  await page.waitForFunction(() => window.__irpg.renderer.handle?.position?.() != null); // the surface scene is up

  // At the start you are far from the beacon: pressing E does nothing, and the goal is shown with a distance.
  const touch = info.project.name.startsWith("mobile");
  if (touch) await page.getByRole("button", { name: "Act", exact: true }).tap();
  else await page.keyboard.press("KeyE");
  expect(await page.evaluate(() => window.__irpg.game.getState().T)).toBe(0);
  const goal = page.locator(".irpg-objective");
  await expect(goal).toBeVisible();
  await expect(goal).toContainText("Walk to the beacon");
  await expect(goal).toContainText(/\d+ m/);

  // Standing at the beacon, the goal goes and the action is offered; now it works.
  await page.evaluate(() => window.__irpg.goToObjective());
  await expect(goal).toBeHidden();
  await expect(page.locator(".irpg-actionbar:not(.irpg-objective)")).toContainText("Scan the beacon");
  if (touch) await page.getByRole("button", { name: "Act", exact: true }).tap();
  else await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__irpg.game.getState().T > 0);
});
