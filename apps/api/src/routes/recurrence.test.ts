import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Label, LabelAssignment, Task } from "@auralis/shared";
import { createHarness, signUp, type Session, type TestHarness } from "../test/harness.js";

describe("recurring tasks", () => {
  let harness: TestHarness;
  let owner: Session;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness);
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  const inTheFuture = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  async function create(body: Record<string, unknown>): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ boardId: owner.boardId, title: "Water the plants", ...body }),
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as { task: Task }).task;
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    return harness.request(`/api/tasks/${id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify(updates),
    });
  }

  async function allTasks(): Promise<Task[]> {
    const response = await harness.request(`/api/tasks?boardId=${owner.boardId}`, {
      session: owner,
    });
    return ((await response.json()) as { tasks: Task[] }).tasks;
  }

  const successorsOf = async (task: Task) =>
    (await allTasks()).filter(
      (candidate) => candidate.title === task.title && candidate.id !== task.id
    );

  it("stores and returns the rule", async () => {
    const task = await create({ title: "Stand-up notes", recurrence: "weekdays" });
    expect(task.recurrence).toBe("weekdays");

    await patch(task.id, { recurrence: null });
    const [reloaded] = (await allTasks()).filter((candidate) => candidate.id === task.id);
    expect(reloaded!.recurrence).toBeNull();
  });

  it("rejects an unknown rule", async () => {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ boardId: owner.boardId, title: "Bad", recurrence: "hourly" }),
    });
    expect(response.status).toBe(400);
  });

  it("puts the next occurrence on the board when one is completed", async () => {
    const due = inTheFuture(3);
    const task = await create({
      title: "Weekly report",
      recurrence: "weekly",
      dueDate: due,
      priority: "high",
      description: "Send it to the team",
    });

    const response = await patch(task.id, { status: "completed" });
    expect(response.status).toBe(200);

    const successors = await successorsOf(task);
    expect(successors).toHaveLength(1);
    expect(successors[0]).toMatchObject({
      status: "todo",
      recurrence: "weekly",
      priority: "high",
      description: "Send it to the team",
      dueDate: inTheFuture(10),
      completedAt: null,
    });

    // The original stays completed: history is not rewritten.
    const original = (await allTasks()).find((candidate) => candidate.id === task.id);
    expect(original!.status).toBe("completed");
  });

  it("does not add a second copy when a task is reopened and completed again", async () => {
    const task = await create({ title: "Pay rent", recurrence: "monthly" });
    await patch(task.id, { status: "completed" });
    await patch(task.id, { status: "todo" });
    await patch(task.id, { status: "completed" });

    expect(await successorsOf(task)).toHaveLength(1);
  });

  it("leaves a one-off task alone", async () => {
    const task = await create({ title: "One-off errand" });
    await patch(task.id, { status: "completed" });
    expect(await successorsOf(task)).toHaveLength(0);
  });

  it("carries the labels over", async () => {
    const task = await create({ title: "Labelled chore", recurrence: "daily" });
    const labelResponse = await harness.request(`/api/boards/${owner.boardId}/labels`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ name: "Chores", color: "#65a30d" }),
    });
    const { label } = (await labelResponse.json()) as { label: Label };
    await harness.request(`/api/tasks/${task.id}/labels`, {
      method: "PUT",
      session: owner,
      body: JSON.stringify({ labelIds: [label.id] }),
    });

    await patch(task.id, { status: "completed" });
    const [successor] = await successorsOf(task);

    const labels = await harness.request(`/api/boards/${owner.boardId}/labels`, {
      session: owner,
    });
    const { assignments } = (await labels.json()) as { assignments: LabelAssignment[] };
    expect(assignments).toContainEqual({ taskId: successor!.id, labelId: label.id });
  });

  it("spawns successors from a bulk completion too", async () => {
    const a = await create({ title: "Bulk recurring A", recurrence: "daily" });
    const b = await create({ title: "Bulk recurring B", recurrence: "weekly" });
    const plain = await create({ title: "Bulk one-off" });

    const response = await harness.request("/api/tasks/bulk", {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ ids: [a.id, b.id, plain.id], updates: { status: "completed" } }),
    });
    expect(response.status).toBe(200);

    expect(await successorsOf(a)).toHaveLength(1);
    expect(await successorsOf(b)).toHaveLength(1);
    expect(await successorsOf(plain)).toHaveLength(0);
  });

  it("announces the new occurrence to every client, the completing one included", async () => {
    const task = await create({ title: "Announced chore", recurrence: "daily" });
    const received: { type: string; origin?: string | null }[] = [];
    const unsubscribe = harness.hub.subscribe({
      id: "recurrence-watcher",
      boardId: owner.boardId,
      userId: owner.userId,
      name: "Owner",
      color: "#000",
      send: (message) =>
        received.push({
          type: message.type,
          origin: "origin" in message ? message.origin : null,
        }),
    });

    await harness.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      session: owner,
      headers: { "X-Client-Id": "completing-client" },
      body: JSON.stringify({ status: "completed" }),
    });
    unsubscribe();

    const upserts = received.filter((message) => message.type === "task.upserted");
    expect(upserts).toHaveLength(2);
    // One is the echo of the completion; the spawned copy carries no origin.
    expect(upserts.map((message) => message.origin).sort()).toEqual(
      ["completing-client", null].sort()
    );
  });
});
