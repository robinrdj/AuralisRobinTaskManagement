import { test, expect, type Page } from "@playwright/test";

/** Every test starts from its own guest session, so they cannot collide. */
async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /try it/i }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect
    .poll(() => page.getByRole("article").count(), { timeout: 20_000 })
    .toBeGreaterThan(5);
}

test.describe("multiple boards", () => {
  test("creates a second board, switches to it, and back", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("button", { name: /switch board/i }).click();
    await page.getByRole("menuitem", { name: /new board/i }).click();
    await page.getByRole("textbox", { name: "New board name" }).fill("Launch plan");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // The new board is empty and is now the active one.
    await expect(page.getByRole("heading", { name: "Your board is empty" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Board: Launch plan/ })).toBeVisible();

    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole("button", { name: /Board: Launch plan/ })).toBeVisible();

    await page.getByRole("button", { name: /switch board/i }).click();
    await page.getByRole("menuitemradio", { name: /My Board/ }).click();
    await expect.poll(() => page.getByRole("article").count()).toBeGreaterThan(5);
  });

  test("renames a board from its settings", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("button", { name: /switch board/i }).click();
    await page.getByRole("menuitem", { name: /board settings/i }).click();

    const dialog = page.getByRole("dialog", { name: "Board settings" });
    await expect(dialog.getByRole("list", { name: "Board members" })).toBeVisible();

    const name = dialog.getByRole("textbox", { name: "Name" });
    await name.fill("Renamed board");
    await name.press("Enter");

    await expect(page.getByRole("button", { name: /Board: Renamed board/ })).toBeVisible();
  });
});
