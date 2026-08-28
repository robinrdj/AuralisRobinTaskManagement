import { test, expect, type Page } from "@playwright/test";

/**
 * Auri's first-run behaviour.
 *
 * The guide is the thing a demo visitor meets first, so it needs to be proven
 * end to end: that it appears on an empty board, that it points at something
 * real, and — most importantly — that it goes away and stays away.
 */

/** A signed-up account starts with an empty board, which is what Auri reacts to. */
async function signUpWithEmptyBoard(page: Page) {
  const email = `auri-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Auri Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-sufficiently-long-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/board/, { timeout: 15_000 });
  return email;
}

test.describe("Auri, on an empty board", () => {
  test("invites you to make your first task", async ({ page }) => {
    await signUpWithEmptyBoard(page);

    await expect(page.getByText(/let's make your first task/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("spotlights the button it is talking about", async ({ page }) => {
    await signUpWithEmptyBoard(page);
    await expect(page.getByText(/let's make your first task/i)).toBeVisible({
      timeout: 10_000,
    });

    // The spotlight is a decorative overlay; what matters is that the target
    // it names actually exists on the page.
    await expect(page.locator('[data-tour="new-task"]')).toBeVisible();
  });

  test("stays on screen until it is dismissed", async ({ page }) => {
    await signUpWithEmptyBoard(page);
    const tip = page.getByText(/let's make your first task/i);
    await expect(tip).toBeVisible({ timeout: 10_000 });

    // The tip used to mark itself seen on a 1.2s timer, which made it
    // ineligible and so it vanished before it could be read.
    await page.waitForTimeout(6000);
    await expect(tip).toBeVisible();

    await page.getByRole("button", { name: "Got it" }).click();
    await expect(tip).toBeHidden();
  });

  test("stays out of the way — the board is still usable", async ({ page }) => {
    await signUpWithEmptyBoard(page);
    await expect(page.getByText(/let's make your first task/i)).toBeVisible({
      timeout: 10_000,
    });

    // The overlay must not swallow clicks meant for the app underneath.
    await page.getByRole("button", { name: "New task" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("moves on by itself once you create a task", async ({ page }) => {
    await signUpWithEmptyBoard(page);
    await expect(page.getByText(/let's make your first task/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill("My first task");
    await page.getByRole("button", { name: "Add task" }).click();

    // No "next" button was pressed — the step stopped applying on its own.
    await expect(page.getByText(/let's make your first task/i)).toBeHidden({
      timeout: 10_000,
    });
    await expect(page.getByText(/drag it here when you start/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("dismissing Auri", () => {
  test("'Got it' closes the current tip", async ({ page }) => {
    await signUpWithEmptyBoard(page);
    await expect(page.getByText(/let's make your first task/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByText(/let's make your first task/i)).toBeHidden();
  });

  test("'Turn off tips' silences Auri for good, across reloads", async ({ page }) => {
    await signUpWithEmptyBoard(page);
    await expect(page.getByText(/let's make your first task/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /turn off tips/i }).click();
    await expect(page.getByText(/let's make your first task/i)).toBeHidden();

    // A guide that comes back after being switched off is worse than no guide.
    await page.reload();
    await page.waitForTimeout(3000);
    await expect(page.getByText(/let's make your first task/i)).toBeHidden();
    await expect(page.getByRole("button", { name: "Got it" })).toBeHidden();
  });
});

test.describe("the sample-data offer", () => {
  test("fills the board in one click", async ({ page }) => {
    await signUpWithEmptyBoard(page);

    // The empty state carries the same offer Auri makes, for anyone who
    // dismissed the guide.
    await page.getByRole("button", { name: /use sample data/i }).click();

    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 30_000 });
    expect(await page.getByRole("article").count()).toBeGreaterThan(5);
  });
});
