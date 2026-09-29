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

/** A calendar day as YYYY-MM-DD in the browser's own timezone. */
async function localDay(page: Page, offsetDays: number): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }, offsetDays);
}

test.describe("calendar", () => {
  test("lists what is due on a day and opens a task from it", async ({ page }) => {
    await startDemo(page);
    await page.goto("/calendar");

    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();

    // The seeded board has something due today, which is selected on arrival.
    const dueToday = page.getByRole("region", { name: "Tasks due on the selected day" });
    await expect(
      dueToday.getByRole("button", { name: /realtime reconnection test/i })
    ).toBeVisible();

    await page.screenshot({ path: test.info().outputPath("calendar.png"), fullPage: true });

    await dueToday.getByRole("button", { name: /realtime reconnection test/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByLabel("Task title", { exact: true })
    ).toHaveValue("Write the realtime reconnection test");
  });

  test("moves between months", async ({ page }) => {
    await startDemo(page);
    await page.goto("/calendar");
    const heading = page.getByRole("heading", { level: 2 });
    const current = await heading.innerText();

    await page.getByRole("button", { name: "Next month" }).click();
    await expect(heading).not.toHaveText(current);
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(heading).toHaveText(current);
  });

  test("reschedules a task by dragging it to another day", async ({ page, isMobile }) => {
    test.skip(isMobile, "Dragging is a pointer interaction; phones reschedule from the panel.");
    await startDemo(page);
    await page.goto("/calendar");

    await expect(page.getByRole("grid")).toBeVisible();
    const today = await localDay(page, 0);
    const target = await localDay(page, 1);
    // Tomorrow may fall in next month's grid; stay in view by using today's row.
    const chip = page
      .locator(`[data-day="${today}"]`)
      .getByRole("button", { name: "Write the realtime reconnection test" });
    const destination = page.locator(`[data-day="${target}"]`);
    test.skip((await destination.count()) === 0, "Tomorrow is not in this month's grid.");

    await chip.dragTo(destination);

    await expect(
      destination.getByRole("button", { name: "Write the realtime reconnection test" })
    ).toBeVisible();
    await expect(page.getByText(/^Moved "Write the realtime/)).toBeVisible();
  });
});

test.describe("timeline", () => {
  test("draws scheduled work, flags an impossible order, and opens a task", async ({
    page,
  }) => {
    await startDemo(page);

    // Make a task depend on one that is due later: an order that cannot work.
    await page
      .getByRole("heading", { name: "Write the realtime reconnection test", exact: true })
      .click();
    const panel = page.getByRole("dialog");
    await panel.getByRole("button", { name: /add a blocker/i }).click();
    await panel
      .getByLabel("Choose a task this one waits on")
      .selectOption({ label: "Reduce the board bundle below 200KB" });
    await expect(panel.getByText(/waiting on 1 unfinished/i)).toBeVisible({ timeout: 15_000 });
    await panel.getByRole("button", { name: "Close details" }).click();

    await page.getByRole("link", { name: "Timeline" }).first().click();
    await expect(page).toHaveURL(/\/timeline/);

    const titles = page.getByRole("list", { name: "Scheduled tasks" });
    await expect(titles.getByRole("button").first()).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: /due before something/ })
    ).toBeVisible();

    await page.screenshot({ path: test.info().outputPath("timeline.png"), fullPage: true });

    await page.getByRole("button", { name: /^Reduce the board bundle below 200KB\. / }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
