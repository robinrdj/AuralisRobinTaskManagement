import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatMention, type Notification, type Task } from "@auralis/shared";
import { createHarness, signUp, type Session, type TestHarness } from "../test/harness.js";

describe("notifications", () => {
  let harness: TestHarness;
  let owner: Session;
  let teammate: Session;
  let teammateEmail: string;
  let outsider: Session;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness, { name: "Owner" });
    teammateEmail = `t-${Math.random().toString(36).slice(2)}@example.com`;
    teammate = await signUp(harness, { email: teammateEmail, name: "Teammate" });
    outsider = await signUp(harness, { name: "Outsider" });
    await harness.request(`/api/boards/${owner.boardId}/members`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ email: teammateEmail }),
    });
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  async function inbox(session: Session, today?: string) {
    const query = today ? `?today=${today}` : "";
    const response = await harness.request(`/api/notifications${query}`, { session });
    return (await response.json()) as { notifications: Notification[]; unread: number };
  }

  async function createTask(body: Record<string, unknown> = {}): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ boardId: owner.boardId, title: "A task", ...body }),
    });
    return ((await response.json()) as { task: Task }).task;
  }

  const find = async (session: Session, kind: string, subject: string) =>
    (await inbox(session)).notifications.find(
      (entry) => entry.kind === kind && entry.subject === subject
    );

  it("tells someone they were added to a board", async () => {
    const invite = await find(teammate, "board_invite", "My Board");
    expect(invite).toMatchObject({ actorName: "Owner", boardId: owner.boardId, readAt: null });
  });

  it("tells someone when a new task is assigned to them", async () => {
    await createTask({ title: "Assigned on creation", assigneeId: teammate.userId });
    expect(await find(teammate, "assigned", "Assigned on creation")).toBeDefined();
  });

  it("tells someone when an existing task is reassigned to them, once", async () => {
    const task = await createTask({ title: "Reassigned later" });
    for (let i = 0; i < 2; i++) {
      await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ assigneeId: teammate.userId, title: "Reassigned later" }),
      });
    }
    const matches = (await inbox(teammate)).notifications.filter(
      (entry) => entry.kind === "assigned" && entry.subject === "Reassigned later"
    );
    expect(matches).toHaveLength(1);
  });

  it("never notifies you about your own action", async () => {
    await createTask({ title: "Self-assigned", assigneeId: owner.userId });
    expect(await find(owner, "assigned", "Self-assigned")).toBeUndefined();
  });

  it("does not notify someone who is not on the board", async () => {
    await createTask({ title: "Assigned to a stranger", assigneeId: outsider.userId });
    expect(await find(outsider, "assigned", "Assigned to a stranger")).toBeUndefined();
  });

  it("covers bulk reassignment", async () => {
    const a = await createTask({ title: "Bulk A" });
    const b = await createTask({ title: "Bulk B" });
    await harness.request("/api/tasks/bulk", {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ ids: [a.id, b.id], updates: { assigneeId: teammate.userId } }),
    });
    expect(await find(teammate, "assigned", "Bulk A")).toBeDefined();
    expect(await find(teammate, "assigned", "Bulk B")).toBeDefined();
  });

  it("tells someone they were mentioned in a comment", async () => {
    const task = await createTask({ title: "Discussed task" });
    await harness.request(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({
        body: `Thoughts, ${formatMention("Teammate", teammate.userId)}?`,
      }),
    });
    expect(await find(teammate, "mentioned", "Discussed task")).toMatchObject({
      taskId: task.id,
      actorName: "Owner",
    });
  });

  it("tells the assignee when the last blocker is finished", async () => {
    const first = await createTask({ title: "Blocker one" });
    const second = await createTask({ title: "Blocker two" });
    const waiting = await createTask({ title: "Waiting task", assigneeId: teammate.userId });
    for (const blocker of [first, second]) {
      await harness.request(`/api/tasks/${waiting.id}/dependencies`, {
        method: "POST",
        session: owner,
        body: JSON.stringify({ blockerId: blocker.id }),
      });
    }

    await harness.request(`/api/tasks/${first.id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ status: "completed" }),
    });
    // One blocker is still open, so it is not ready yet.
    expect(await find(teammate, "unblocked", "Waiting task")).toBeUndefined();

    await harness.request(`/api/tasks/${second.id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ status: "completed" }),
    });
    expect(await find(teammate, "unblocked", "Waiting task")).toBeDefined();
  });

  it("reminds about assigned work due today or tomorrow, once per due date", async () => {
    const today = "2031-05-10";
    await createTask({ title: "Due today", dueDate: today, assigneeId: teammate.userId });
    await createTask({
      title: "Due tomorrow",
      dueDate: "2031-05-11",
      assigneeId: teammate.userId,
    });
    await createTask({
      title: "Due later",
      dueDate: "2031-05-20",
      assigneeId: teammate.userId,
    });
    await createTask({
      title: "Due but done",
      dueDate: today,
      assigneeId: teammate.userId,
      status: "completed",
    });

    await inbox(teammate, today);
    const { notifications } = await inbox(teammate, today);
    const due = notifications.filter((entry) => entry.kind === "due_soon");
    expect(due.map((entry) => [entry.subject, entry.detail]).sort()).toEqual([
      ["Due today", "today"],
      ["Due tomorrow", "tomorrow"],
    ]);
  });

  it("marks some or all as read", async () => {
    const before = await inbox(teammate);
    expect(before.unread).toBeGreaterThan(1);

    const [first] = before.notifications;
    await harness.request("/api/notifications/read", {
      method: "POST",
      session: teammate,
      body: JSON.stringify({ ids: [first!.id] }),
    });
    expect((await inbox(teammate)).unread).toBe(before.unread - 1);

    await harness.request("/api/notifications/read", {
      method: "POST",
      session: teammate,
      body: JSON.stringify({}),
    });
    expect((await inbox(teammate)).unread).toBe(0);
  });

  it("cannot mark someone else's notifications read", async () => {
    await createTask({ title: "Private notice", assigneeId: teammate.userId });
    const notice = await find(teammate, "assigned", "Private notice");

    await harness.request("/api/notifications/read", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ ids: [notice!.id] }),
    });
    expect((await find(teammate, "assigned", "Private notice"))!.readAt).toBeNull();
  });

  it("pings the recipient's open connections on any board", async () => {
    const received: string[] = [];
    // Watching their own board, not the one where the change happens.
    const unsubscribe = harness.hub.subscribe({
      id: "inbox-watcher",
      boardId: teammate.boardId,
      userId: teammate.userId,
      name: "Teammate",
      color: "#000",
      send: (message) => received.push(message.type),
    });
    await createTask({ title: "Live ping", assigneeId: teammate.userId });
    unsubscribe();
    expect(received).toContain("notification.new");
  });
});
