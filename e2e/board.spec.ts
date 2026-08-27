import { test, expect, type Page } from "@playwright/test";

/**
 * The flows a first-time visitor actually takes.
 *
 * These are deliberately few and end-to-end rather than exhaustive: the unit
 * and integration suites already cover the logic, so what is left to prove is
 * that the pieces are wired together — cookies reach the API, optimistic
 * writes persist, and the guide appears when it should.
 */

/** Every test starts from its own guest session, so they cannot collide. */
async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /try it/i }).click();
  await expect(page).toHaveURL(/\/board/);

  // Wait for the seeded board to settle, not just for the first card to
  // appear. A bare `count()` taken mid-render returns whatever that frame
  // happened to hold, which makes every count-based assertion downstream flaky.
  await expect
    .poll(() => page.getByRole("article").count(), { timeout: 20_000 })
    .toBeGreaterThan(5);
}

test.describe("landing page", () => {
  test("explains the product and offers a no-signup demo", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /a task board that keeps up/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /try it/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
  });

  test("sends an unknown route back to the landing page", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page).toHaveURL("/");
  });
});

test.describe("guest demo", () => {
  test("lands on a board that already has work on it", async ({ page }) => {
    await startDemo(page);

    // A demo board with nothing on it is the failure this replaces.
    const cards = page.getByRole("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(5);

    for (const column of ["To do", "In progress", "In review", "Done"]) {
      await expect(page.getByRole("heading", { name: column, exact: true })).toBeVisible();
    }
  });

  test("survives a reload without signing in again", async ({ page }) => {
    await startDemo(page);
    await page.reload();

    // The claim is that the session cookie carried the user back to their own
    // board. Pinning an exact card count would instead be racing whichever
    // render the snapshot landed on.
    await expect(page).toHaveURL(/\/board/);
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.getByRole("article").count(), { timeout: 10_000 })
      .toBeGreaterThan(5);
  });

  test("shows overdue work in a way you cannot miss", async ({ page }) => {
    await startDemo(page);
    await expect(page.getByText(/days overdue/i).first()).toBeVisible();
  });
});

test.describe("creating a task", () => {
  test("adds it to the board and offers an undo", async ({ page }) => {
    await startDemo(page);
    const title = `E2E task ${Date.now()}`;

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Add task" }).click();

    await expect(page.getByText(`Added "${title}"`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });

  test("undo removes it again", async ({ page }) => {
    await startDemo(page);
    const title = `Retract this ${Date.now()}`;

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Add task" }).click();

    // Click Undo as soon as it appears — the toast is deliberately short-lived,
    // so asserting anything else first races its expiry.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("heading", { name: title })).toBeHidden();

    // Gone from the server too, not just from the screen.
    await page.reload();
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: title })).toBeHidden();
  });

  test("refuses to create a task with no title", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByRole("button", { name: "Add task" }).click();

    await expect(page.getByRole("alert")).toContainText(/needs a title/i);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("closes on Escape without saving", async ({ page }) => {
    await startDemo(page);
    const before = await page.getByRole("article").count();

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill("Never saved");
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("article")).toHaveCount(before);
  });
});

test.describe("search and filters", () => {
  test("narrows the board and can be cleared again", async ({ page }) => {
    await startDemo(page);
    const before = await page.getByRole("article").count();

    await page.getByRole("searchbox", { name: /search tasks/i }).fill("timezone");
    await expect(page.getByRole("article")).toHaveCount(1, { timeout: 5000 });

    await page.getByRole("searchbox", { name: /search tasks/i }).fill("");
    await expect(page.getByRole("article")).toHaveCount(before, { timeout: 5000 });
  });

  test("filters to overdue work only", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("button", { name: "Overdue", exact: true }).click();
    const cards = page.getByRole("article");
    await expect(cards.first()).toBeVisible();

    // Everything left must carry an overdue chip.
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText(/overdue/i);
    }
  });
});

test.describe("keyboard", () => {
  test("opens the command palette with Ctrl-K and navigates with it", async ({ page }) => {
    await startDemo(page);

    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/search tasks or run a command/i)).toBeVisible();

    await page.getByPlaceholder(/search tasks or run a command/i).fill("analytics");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/analytics/);
  });

  test("closes the palette on Escape", async ({ page }) => {
    await startDemo(page);

    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/search tasks or run a command/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/search tasks or run a command/i)).toBeHidden();
  });

  test("offers a skip link as the first tab stop", async ({ page }) => {
    await startDemo(page);

    // Reload so focus starts at the top of the document. Reaching the demo
    // leaves focus on whatever was last clicked, which is not where a keyboard
    // user arriving at the page begins.
    await page.reload();
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
  });
});

test.describe("analytics", () => {
  test("reports figures derived from the board", async ({ page }) => {
    await startDemo(page);
    const cards = await page.getByRole("article").count();

    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

    // The headline total must agree with what the board is showing.
    await expect(page.getByText("Total tasks")).toBeVisible();
    await expect(page.getByText(String(cards), { exact: true }).first()).toBeVisible();
  });

  test("offers a table view of every chart", async ({ page }) => {
    await startDemo(page);
    await page.getByRole("link", { name: "Analytics" }).click();

    const toggle = page.getByRole("button", { name: "Table" }).first();
    await toggle.click();

    // A chart alone cannot be read by a screen reader; the table is the fallback.
    await expect(page.getByRole("table").first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
  });
});

test.describe("theme", () => {
  test("remembers an explicit choice across a reload", async ({ page }) => {
    await startDemo(page);

    const toggle = page.getByRole("button", { name: /^Theme:/ });
    await toggle.click();
    const chosen = await page.locator("html").getAttribute("data-theme");
    expect(chosen).toBeTruthy();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", chosen!);
  });
});
