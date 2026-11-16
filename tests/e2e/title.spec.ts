import { expect, test } from "@playwright/test";

/** The test hook, read inside the page (the full typing lives in slice.spec.ts). */
declare const window: {
  __irpg: {
    game: { getState(): { T: number; controlled: string } };
    goToObjective(): void;
    renderer: { handle: { position?(): unknown } | null };
  };
};

test("the title screen shows the fan-project notice before play, and New game starts the game", async ({ page }) => {
  await page.goto("./");
  const title = page.locator(".irpg-title");
  await expect(title).toBeVisible();
  await expect(title).toContainText("not affiliated");
  await expect(title.getByRole("button", { name: "Credits" })).toBeVisible();
  await title.getByRole("button", { name: "New game" }).click();
  await expect(title).toHaveCount(0);
  await expect(page.locator(".irpg-btn").first()).toBeVisible();
  // The opening scene's first subtitle appears once the title is gone.
  await expect(page.locator(".irpg-sub")).toBeVisible();
});

test("gameplay keys do nothing behind the title screen, and work once the game starts", async ({ page }) => {
  await page.goto("./?debug&frozen&title");
  await expect(page.locator(".irpg-title")).toBeVisible();
  for (const key of ["e", "q", "2", "ArrowUp"]) await page.keyboard.press(key);
  const before = await page.evaluate(() => {
    const s = window.__irpg.game.getState();
    return { T: s.T, controlled: s.controlled };
  });
  expect(before).toEqual({ T: 0, controlled: "char.cooper" });
  await page.locator(".irpg-title").getByRole("button", { name: "New game" }).click();
  await page.waitForFunction(() => window.__irpg.renderer.handle?.position?.() != null);
  await page.evaluate(() => window.__irpg.goToObjective()); // the scan needs Cooper at the beacon (PLAY-001)
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__irpg.game.getState().T > 0);
});
