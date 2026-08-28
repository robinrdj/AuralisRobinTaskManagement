import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

/**
 * Export, import, keyboard shortcuts and dependencies.
 *
 * Export and import existed in v1 and were lost in the rewrite, so these guard
 * against losing them a second time.
 */
async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /try it/i }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect
    .poll(() => page.getByRole("article").count(), { timeout: 20_000 })
    .toBeGreaterThan(5);
}

/** Writes a fixture into a temp dir and returns its path. */
async function fixture(name: string, contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "auralis-e2e-"));
  const file = path.join(dir, name);
  await writeFile(file, contents, "utf8");
  return file;
}

test.describe("export", () => {
  // Downloading a file is a desktop flow, and Playwright's phone emulation
  // does not deliver the download event reliably. The parsing these assert on
  // is covered directly by the shared package's unit tests.
  test.skip(({ isMobile }) => Boolean(isMobile), "file downloads are desktop-only");

  test("downloads the board as JSON", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("button", { name: "Data" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Download JSON" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    expect(parsed.taskCount).toBeGreaterThan(5);
    expect(parsed.tasks[0]).toHaveProperty("title");
    expect(parsed.exportedAt).toBeTruthy();
  });

  test("downloads the board as CSV with a header row", async ({ page }) => {
    await startDemo(page);

    await page.getByRole("button", { name: "Data" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Download CSV" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");

    expect(text.split("\r\n")[0]).toContain("title");
    expect(text.split("\r\n").length).toBeGreaterThan(5);
  });
});

test.describe("import", () => {
  test("previews a file before writing anything", async ({ page }) => {
    await startDemo(page);
    const before = await page.getByRole("article").count();
    const file = await fixture(
      "import.json",
      JSON.stringify([{ title: "Imported one" }, { title: "Imported two" }])
    );

    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("menuitem", { name: /import a file/i }).click();
    await page.locator('input[type="file"]').setInputFiles(file);

    await expect(page.getByRole("dialog")).toContainText("Import 2 tasks?");
    // Nothing is written until the preview is confirmed.
    expect(await page.getByRole("article").count()).toBe(before);
  });

  test("adds the tasks once confirmed", async ({ page }) => {
    await startDemo(page);
    const before = await page.getByRole("article").count();
    const title = `Imported ${Date.now()}`;
    const file = await fixture("import.json", JSON.stringify([{ title }]));

    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("menuitem", { name: /import a file/i }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("button", { name: /^Import 1$/ }).click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("article")).toHaveCount(before + 1);
  });

  test("reports bad rows instead of importing nonsense", async ({ page }) => {
    await startDemo(page);
    const file = await fixture(
      "messy.csv",
      "title,status,dueDate\nGood one,todo,2026-09-01\n,todo,2026-09-01\nBad date,todo,not-a-date\n"
    );

    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("menuitem", { name: /import a file/i }).click();
    await page.locator('input[type="file"]').setInputFiles(file);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Import 2 tasks?");
    await expect(dialog).toContainText(/no title/i);
    await expect(dialog).toContainText(/could not read the date/i);
  });

  test("refuses a file with nothing usable in it", async ({ page }) => {
    await startDemo(page);
    const file = await fixture("broken.json", "{not json at all");

    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("menuitem", { name: /import a file/i }).click();
    await page.locator('input[type="file"]').setInputFiles(file);

    await expect(page.getByRole("dialog")).toContainText("Nothing to import");
    await expect(page.getByRole("button", { name: /^Import 0$/ })).toBeDisabled();
  });

  test("round-trips its own export", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "file downloads are desktop-only");
    await startDemo(page);
    const before = await page.getByRole("article").count();

    await page.getByRole("button", { name: "Data" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Download JSON" }).click(),
    ]);
    const exported = await download.path();

    await page.getByRole("button", { name: "Data" }).click();
    await page.getByRole("menuitem", { name: /import a file/i }).click();
    await page.locator('input[type="file"]').setInputFiles(exported);

    // Every exported task comes back as importable.
    await expect(page.getByRole("dialog")).toContainText(`Import ${before} tasks?`);
  });
});

test.describe("keyboard shortcuts", () => {
  test("N opens the new task dialog", async ({ page }) => {
    await startDemo(page);
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Title")).toBeVisible();
  });

  test("does not fire while typing in the search box", async ({ page }) => {
    await startDemo(page);
    const search = page.getByRole("searchbox", { name: /search tasks/i });

    await search.fill("n");
    // Typing "n" must reach the field, not open a dialog.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(search).toHaveValue("n");
  });

  test("? shows the shortcut list", async ({ page }) => {
    await startDemo(page);
    await page.keyboard.press("?");

    await expect(
      page.getByRole("heading", { name: "Keyboard shortcuts", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Move the focused card between columns")).toBeVisible();
  });

  test("1-4 moves the focused card between columns", async ({ page }) => {
    await startDemo(page);

    const card = page.getByRole("article").filter({ hasText: "Audit colour contrast" }).first();
    await card.getByRole("button").first().focus();

    // 4 is the last column, "Done".
    await page.keyboard.press("4");

    const done = page.locator('[data-tour="column-completed"]');
    await expect(done.getByRole("heading", { name: /Audit colour contrast/ })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("dependencies", () => {
  test("records what a task waits on and warns about it", async ({ page }) => {
    await startDemo(page);

    await page
      .getByRole("heading", { name: "Audit colour contrast in dark mode", exact: true })
      .click();
    const panel = page.getByRole("dialog");

    await panel.getByRole("button", { name: /add a blocker/i }).click();
    await panel.getByLabel("Choose a task this one waits on").selectOption({ index: 1 });

    await expect(panel.getByText(/waiting on 1 unfinished task/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("does not offer a task that is already linked, so a loop cannot be made", async ({
    page,
  }) => {
    await startDemo(page);

    await page
      .getByRole("heading", { name: "Audit colour contrast in dark mode", exact: true })
      .click();
    const panel = page.getByRole("dialog");

    await panel.getByRole("button", { name: /add a blocker/i }).click();
    const picker = panel.getByLabel("Choose a task this one waits on");
    const blockerTitle = (await picker.locator("option").nth(1).innerText()).trim();
    await picker.selectOption({ index: 1 });
    await expect(panel.getByText(/waiting on 1 unfinished/i)).toBeVisible({ timeout: 15_000 });

    // Re-opening the picker must not offer the same task again — which is why
    // a direct cycle is unreachable from the interface. The API rejects one
    // anyway; that is covered by the integration tests.
    await panel.getByRole("button", { name: /add a blocker/i }).click();
    const options = await panel
      .getByLabel("Choose a task this one waits on")
      .locator("option")
      .allInnerTexts();
    expect(options.map((text) => text.trim())).not.toContain(blockerTitle);
  });
});
