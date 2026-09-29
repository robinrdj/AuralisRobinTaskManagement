import { test, expect, type Page } from "@playwright/test";

const SEEDED_CARD = "Audit colour contrast in dark mode";

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

test.describe("labels", () => {
  test("creates a label on a task, shows it on the card, and filters by it", async ({
    page,
  }) => {
    await startDemo(page);
    const total = await page.getByRole("article").count();

    await page.getByRole("heading", { name: SEEDED_CARD, exact: true }).click();
    const panel = page.getByRole("dialog");
    const section = panel.getByRole("region", { name: "Labels" });

    await section.getByRole("button", { name: "Edit labels" }).click();
    await section.getByRole("textbox", { name: "New label name" }).fill("Accessibility");
    await section.getByRole("button", { name: "Create label" }).click();
    await expect(
      section.getByRole("button", { name: "Accessibility", pressed: true })
    ).toBeVisible();

    await panel.getByRole("button", { name: "Close details" }).click();

    const card = page.getByRole("article").filter({ hasText: SEEDED_CARD });
    await expect(card.getByRole("list", { name: "Labels" })).toContainText("Accessibility");

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page
      .getByRole("group", { name: "Labels" })
      .getByRole("button", { name: "Accessibility" })
      .click();

    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText(SEEDED_CARD);

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByRole("article")).toHaveCount(total);
  });

  test("brings a task's labels back when its deletion is undone", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("heading", { name: SEEDED_CARD, exact: true }).click();
    const panel = page.getByRole("dialog");
    const section = panel.getByRole("region", { name: "Labels" });
    await section.getByRole("button", { name: "Edit labels" }).click();
    await section.getByRole("textbox", { name: "New label name" }).fill("Keep me");
    await section.getByRole("button", { name: "Create label" }).click();
    await expect(section.getByRole("button", { name: "Keep me", pressed: true })).toBeVisible();

    await panel.getByRole("button", { name: "Delete task" }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();

    const card = page.getByRole("article").filter({ hasText: SEEDED_CARD });
    await expect(card.getByRole("list", { name: "Labels" })).toContainText("Keep me", {
      timeout: 10_000,
    });
  });
});
