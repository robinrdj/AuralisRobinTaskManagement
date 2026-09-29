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
  return page.getByRole("dialog");
}

test.describe("comments", () => {
  test("posts, edits and deletes a comment", async ({ page }) => {
    const panel = await openSeededCard(page);
    const thread = panel.getByRole("region", { name: "Comments" });

    await thread
      .getByRole("textbox", { name: "New comment" })
      .fill("Checked the header, looks fine");
    await thread.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(thread.getByText("Checked the header, looks fine")).toBeVisible();

    // It is also recorded in the history.
    await expect(panel.getByText("commented")).toBeVisible();

    await thread.getByRole("button", { name: "Edit", exact: true }).click();
    const editBox = thread.getByRole("textbox", { name: "Edit comment" });
    await editBox.fill("Checked the header and footer");
    await thread.getByRole("button", { name: "Save", exact: true }).click();
    await expect(thread.getByText("Checked the header and footer")).toBeVisible();
    await expect(thread.getByText(/edited/)).toBeVisible();

    // Survives a reload.
    await page.reload();
    await page.getByRole("heading", { name: SEEDED_CARD, exact: true }).click();
    const reopened = page.getByRole("dialog").getByRole("region", { name: "Comments" });
    await expect(reopened.getByText("Checked the header and footer")).toBeVisible();

    await reopened.getByRole("button", { name: /delete comment/i }).click();
    await expect(reopened.getByText("No comments yet. Start the conversation.")).toBeVisible();
  });

  test("Escape closes the panel when no suggestion list is open", async ({ page }) => {
    const panel = await openSeededCard(page);
    await panel.getByRole("textbox", { name: "New comment" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
