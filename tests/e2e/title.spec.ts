import { expect, test } from "@playwright/test";

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
