import { test, expect, type Page } from "@playwright/test";

/**
 * The task detail panel.
 *
 * Clicking a card used to do nothing at all, so these exist to keep the panel
 * wired up: it opens, it saves, it closes, and it reflects the board.
 */
/** A card that the seeded demo board always contains. */
const SEEDED_CARD = "Audit colour contrast in dark mode";

/**
 * Turns the guide's tips off. A tip stays until dismissed and can sit over
 * the card a test wants to click, which is not what these tests are about.
 */
async function dismissTips(page: Page) {
  await page
    .getByRole("button", { name: /turn off tips/i })
    .click({ timeout: 3_000 })
    .catch(() => {
      // No tip showing; nothing to dismiss.
    });
}

/**
 * Opens a known seeded card rather than "the first one".
 *
 * Which card sorts first can shift as the board renders, so naming the card
 * keeps these tests deterministic.
 */
async function openCard(page: Page, title = SEEDED_CARD) {
  await page.goto("/");
  await page.getByRole("button", { name: /try it/i }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect
    .poll(() => page.getByRole("article").count(), { timeout: 20_000 })
    .toBeGreaterThan(5);

  await dismissTips(page);
  await page.getByRole("heading", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return title;
}

test.describe("opening a task", () => {
  test("clicking a card shows its details", async ({ page }) => {
    const title = await openCard(page);

    const panel = page.getByRole("dialog");
    await expect(panel.getByLabel("Task title", { exact: true })).toHaveValue(title);
    await expect(panel.getByLabel("Status")).toBeVisible();
    await expect(panel.getByLabel("Priority")).toBeVisible();
    await expect(panel.getByLabel("Due date")).toBeVisible();
  });

  test("shows the history the board was seeded with", async ({ page }) => {
    await openCard(page);

    // An empty history panel on a demo board shows the feature not working.
    await expect(page.getByRole("dialog").getByText("created this task")).toBeVisible();
  });

  test("closes on Escape and on the close button", async ({ page }) => {
    await openCard(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("heading", { name: SEEDED_CARD, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("editing from the panel", () => {
  test("renames the task and the card follows", async ({ page }) => {
    await openCard(page);
    const renamed = `Renamed ${Date.now()}`;

    const field = page.getByRole("dialog").getByLabel("Task title", { exact: true });
    await field.fill(renamed);
    await field.blur();

    await expect(
      page.getByRole("dialog").getByLabel("Task title", { exact: true })
    ).toHaveValue(renamed);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
  });

  test("reverts an emptied title rather than leaving a nameless card", async ({ page }) => {
    const original = await openCard(page);

    const field = page.getByRole("dialog").getByLabel("Task title", { exact: true });
    await field.fill("");
    await field.blur();

    await expect(field).toHaveValue(original);
  });

  test("changing status records it in the history", async ({ page }) => {
    await openCard(page);
    const panel = page.getByRole("dialog");

    await panel.getByLabel("Status").selectOption("review");

    await expect(panel.getByText("moved it")).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(/status:/)).toBeVisible();
  });

  test("a change survives a reload", async ({ page }) => {
    await openCard(page);
    await page.getByRole("dialog").getByLabel("Priority").selectOption("urgent");
    await page.waitForTimeout(1500);

    await page.reload();
    await expect
      .poll(() => page.getByRole("article").count(), { timeout: 20_000 })
      .toBeGreaterThan(5);
    await page.getByRole("heading", { name: SEEDED_CARD, exact: true }).click();

    await expect(page.getByRole("dialog").getByLabel("Priority")).toHaveValue("urgent");
  });
});

test.describe("subtasks", () => {
  test("adds one, ticks it off, and counts it on the card", async ({ page }) => {
    await openCard(page);
    const panel = page.getByRole("dialog");

    await panel.getByLabel("New subtask title").fill("A nested piece of work");
    await panel.getByRole("button", { name: "Add", exact: true }).click();

    await expect(panel.getByText("A nested piece of work")).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText("0 of 1 done")).toBeVisible();

    await panel.getByRole("checkbox", { name: /Mark "A nested piece of work" done/ }).check();
    await expect(panel.getByText("1 of 1 done")).toBeVisible({ timeout: 10_000 });
  });

  test("keeps the subtask off the top level of the board", async ({ page }) => {
    await openCard(page);
    const panel = page.getByRole("dialog");
    const before = await page.getByRole("article").count();

    await panel.getByLabel("New subtask title").fill("Hidden from the columns");
    await panel.getByRole("button", { name: "Add", exact: true }).click();
    await expect(panel.getByText("Hidden from the columns")).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press("Escape");
    // Subtasks belong to their parent card, not to a column of their own.
    await expect(page.getByRole("article")).toHaveCount(before);
    await expect(page.getByRole("heading", { name: "Hidden from the columns" })).toBeHidden();
  });
});

test.describe("deleting from the panel", () => {
  test("removes the card and closes the panel", async ({ page }) => {
    const title = await openCard(page);
    const before = await page.getByRole("article").count();

    await page.getByRole("button", { name: "Delete task" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: title })).toBeHidden();
    await expect(page.getByRole("article")).toHaveCount(before - 1);
  });
});
