import { test, expect, type Page } from "@playwright/test";

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /try it/i }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect
    .poll(() => page.getByRole("article").count(), { timeout: 20_000 })
    .toBeGreaterThan(5);
  await page
    .getByRole("button", { name: /turn off tips/i })
    .click({ timeout: 3_000 })
    .catch(() => {});
}

test.describe("recurring tasks", () => {
  test("completing a repeating task puts the next one on the board", async ({ page }) => {
    await startDemo(page);
    const title = `Water the plants ${Date.now()}`;

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Repeat").selectOption("weekly");
    await page.getByRole("button", { name: "Add task" }).click();

    const cards = page.getByRole("article").filter({ hasText: title });
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Repeats");

    await page.getByRole("heading", { name: title, exact: true }).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByLabel("Repeat")).toHaveValue("weekly");
    await panel.getByLabel("Status").selectOption("completed");
    await panel.getByRole("button", { name: "Close details" }).click();

    // The finished one moves to Done, and a fresh copy waits in To do.
    await expect(cards).toHaveCount(2, { timeout: 10_000 });
    await expect(
      page.locator('[data-tour="column-completed"]').getByRole("heading", { name: title })
    ).toBeVisible();
    await expect(
      page.locator('[data-tour="column-todo"]').getByRole("heading", { name: title })
    ).toBeVisible();

    // And it survives a reload — the copy was made on the server.
    await page.reload();
    await expect(page.getByRole("article").filter({ hasText: title })).toHaveCount(2, {
      timeout: 15_000,
    });
  });
});
