import { test, expect, type APIRequestContext } from "@playwright/test";

/** Signs up through the API; the request context keeps the session cookies. */
async function signUp(request: APIRequestContext, name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const response = await request.post("/api/auth/signup", {
    data: { email, password: "a-sufficiently-long-password", name },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user: { id: string }; boardId: string };
  return { email, userId: body.user.id, boardId: body.boardId };
}

test.describe("notifications", () => {
  test("an assignment on a shared board reaches the teammate's bell", async ({
    page,
    browser,
  }) => {
    // The teammate signs in through the page; the owner acts from another browser.
    const teammate = await signUp(page.request, "Teammate");
    const ownerContext = await browser.newContext({ baseURL: "http://localhost:5173" });
    const owner = await signUp(ownerContext.request, "Owner");

    const invite = await ownerContext.request.post(`/api/boards/${owner.boardId}/members`, {
      data: { email: teammate.email, role: "editor" },
    });
    expect(invite.status()).toBe(201);

    const task = await ownerContext.request.post("/api/tasks", {
      data: {
        boardId: owner.boardId,
        title: "Review the launch copy",
        assigneeId: teammate.userId,
      },
    });
    expect(task.status()).toBe(201);

    await page.goto("/board");
    const bell = page.getByRole("button", { name: /Notifications, 2 unread/ });
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await bell.click();

    const menu = page.getByRole("menu", { name: "Notifications" });
    await expect(menu.getByText('Owner added you to the board "My Board"')).toBeVisible();
    await menu
      .getByRole("menuitem", { name: /Owner assigned you "Review the launch copy"/ })
      .click();

    // Opening it switches to the owner's board and opens the task there.
    await expect(
      page.getByRole("dialog").getByLabel("Task title", { exact: true })
    ).toHaveValue("Review the launch copy");
    await expect(page.getByRole("button", { name: /Notifications, 1 unread/ })).toBeVisible();

    await page.getByRole("button", { name: "Close details" }).click();
    await page.getByRole("button", { name: /Notifications, 1 unread/ }).click();
    await page.getByRole("menuitem", { name: "Mark all as read" }).click();
    await expect(
      page.getByRole("button", { name: "Notifications", exact: true })
    ).toBeVisible();

    await ownerContext.close();
  });

  test("arrives live, without a reload", async ({ page, browser }) => {
    const teammate = await signUp(page.request, "Teammate");
    const ownerContext = await browser.newContext({ baseURL: "http://localhost:5173" });
    const owner = await signUp(ownerContext.request, "Owner");
    await ownerContext.request.post(`/api/boards/${owner.boardId}/members`, {
      data: { email: teammate.email },
    });

    await page.goto("/board");
    await expect(page.getByRole("button", { name: /Notifications, 1 unread/ })).toBeVisible({
      timeout: 15_000,
    });
    // Let the board's live connection open before the owner acts.
    await expect(page.getByLabel(/people viewing/)).toBeVisible({ timeout: 15_000 });

    await ownerContext.request.post("/api/tasks", {
      data: { boardId: owner.boardId, title: "Live one", assigneeId: teammate.userId },
    });
    // Well inside the one-minute poll, so this can only be the live channel.
    await expect(page.getByRole("button", { name: /Notifications, 2 unread/ })).toBeVisible({
      timeout: 10_000,
    });

    await ownerContext.close();
  });
});
