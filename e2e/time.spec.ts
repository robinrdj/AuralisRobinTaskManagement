import { test, expect, type Page } from "@playwright/test";

const SEEDED_CARD = "Audit colour contrast in dark mode";

async function openSeededCard(page: Page) {
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
  await page.getByRole("heading", { name: SEEDED_CARD, exact: true }).click();
  return page.getByRole("dialog").getByRole("region", { name: "Time" });
}

test.describe("time tracking", () => {
  test("estimates, logs time by hand, and reports it", async ({ page }) => {
    const section = await openSeededCard(page);

    const estimate = section.getByLabel("Estimate (hours)");
    await estimate.fill("1");
    await estimate.press("Enter");
    await expect(section.getByText("0s tracked of 1h 00m")).toBeVisible();

    await section.getByLabel("Minutes to add").fill("45");
    await section.getByRole("button", { name: "Log time" }).click();
    await expect(section.getByText("45m tracked of 1h 00m")).toBeVisible();
    await expect(section.getByRole("meter")).toHaveAttribute("aria-valuenow", "75");

    await page.screenshot({ path: test.info().outputPath("time-panel.png") });

    await page.getByRole("button", { name: "Close details" }).click();
    await page.getByRole("link", { name: "Analytics" }).first().click();
    const report = page.getByRole("table").filter({ hasText: SEEDED_CARD });
    await expect(report).toContainText("45m");
    await expect(report).toContainText("75%");
  });

  test("runs a timer that follows you around the app", async ({ page }) => {
    const section = await openSeededCard(page);

    await section.getByRole("button", { name: "Start timer" }).click();
    await expect(section.getByRole("button", { name: "Stop timer" })).toBeVisible();

    await page.getByRole("button", { name: "Close details" }).click();
    await page.getByRole("link", { name: "Calendar" }).first().click();

    // The header keeps the clock visible on every page.
    const chip = page.getByRole("button", {
      name: new RegExp(`Timer running on ${SEEDED_CARD}`),
    });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(/0:00:0[1-9]/, { timeout: 10_000 });

    await page.getByRole("button", { name: "Stop the timer" }).click();
    await expect(chip).toBeHidden();
  });
});
