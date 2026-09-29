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

test.describe("saved views", () => {
  test("saves the current filters and brings them back later", async ({ page }) => {
    await startDemo(page);
    const everything = await page.getByRole("article").count();

    // The search is debounced, so wait for it to narrow the board before going on.
    await page.getByRole("searchbox", { name: /search tasks/i }).fill("audit");
    await expect.poll(() => page.getByRole("article").count()).toBeLessThan(everything);
    const searched = await page.getByRole("article").count();
    await page.getByRole("button", { name: "Overdue", exact: true }).click();
    await expect.poll(() => page.getByRole("article").count()).toBeLessThanOrEqual(searched);
    const narrowed = await page.getByRole("article").count();

    await page.getByRole("button", { name: "Saved views", exact: true }).click();
    await page.getByLabel("Save the current view").fill("Late audits");
    await page.getByRole("button", { name: "Save view" }).click();

    // The button now names the view the board is showing.
    await expect(page.getByRole("button", { name: "Saved views: Late audits" })).toBeVisible();

    // The menu stays open after saving, with the new view listed and active.
    await expect(page.getByRole("menuitemradio", { name: /Late audits/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await page.getByRole("menuitem", { name: "Back to everything" }).click();
    await expect(page.getByRole("article")).toHaveCount(everything);
    await expect(page.getByRole("searchbox", { name: /search tasks/i })).toHaveValue("");

    // It is stored on the server, so it survives a reload.
    await page.reload();
    await page.getByRole("button", { name: "Saved views", exact: true }).click();
    await page.getByRole("menuitemradio", { name: /Late audits/ }).click();

    await expect(page.getByRole("article")).toHaveCount(narrowed);
    await expect(page.getByRole("searchbox", { name: /search tasks/i })).toHaveValue("audit");
    await expect(page.getByRole("button", { name: "Overdue", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
