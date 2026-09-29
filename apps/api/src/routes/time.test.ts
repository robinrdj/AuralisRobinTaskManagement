import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RunningTimer, Task, TimeEntry } from "@auralis/shared";
import { createHarness, signUp, type Session, type TestHarness } from "../test/harness.js";

describe("time tracking", () => {
  let harness: TestHarness;
  let owner: Session;
  let editor: Session;
  let viewer: Session;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness, { name: "Owner" });
    const editorEmail = `e-${Math.random().toString(36).slice(2)}@example.com`;
    const viewerEmail = `v-${Math.random().toString(36).slice(2)}@example.com`;
    editor = await signUp(harness, { email: editorEmail, name: "Editor" });
    viewer = await signUp(harness, { email: viewerEmail, name: "Viewer" });
    for (const [email, role] of [
      [editorEmail, "editor"],
      [viewerEmail, "viewer"],
    ] as const) {
      await harness.request(`/api/boards/${owner.boardId}/members`, {
        method: "POST",
        session: owner,
        body: JSON.stringify({ email, role }),
      });
    }
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  async function createTask(title = "Tracked task"): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ boardId: owner.boardId, title }),
    });
    return ((await response.json()) as { task: Task }).task;
  }

  const start = (session: Session, taskId: string) =>
    harness.request(`/api/tasks/${taskId}/time/start`, { method: "POST", session });

  async function running(session: Session): Promise<RunningTimer | null> {
    const response = await harness.request("/api/time/running", { session });
    return ((await response.json()) as { entry: RunningTimer | null }).entry;
  }

  async function entries(taskId: string): Promise<TimeEntry[]> {
    const response = await harness.request(`/api/tasks/${taskId}/time`, { session: owner });
    return ((await response.json()) as { entries: TimeEntry[] }).entries;
  }

  it("starts and stops a timer", async () => {
    const task = await createTask("Timer task");
    expect((await start(owner, task.id)).status).toBe(201);

    const timer = await running(owner);
    expect(timer).toMatchObject({ taskId: task.id, taskTitle: "Timer task", endedAt: null });

    const stop = await harness.request("/api/time/stop", { method: "POST", session: owner });
    expect(stop.status).toBe(200);
    expect(await running(owner)).toBeNull();

    const [entry] = await entries(task.id);
    expect(entry!.endedAt).not.toBeNull();
  });

  it("keeps one running timer per person: starting another stops the first", async () => {
    const first = await createTask("First");
    const second = await createTask("Second");
    await start(owner, first.id);
    await start(owner, second.id);

    expect((await running(owner))!.taskId).toBe(second.id);
    expect((await entries(first.id))[0]!.endedAt).not.toBeNull();
    await harness.request("/api/time/stop", { method: "POST", session: owner });
  });

  it("lets two people run timers on the same task at once", async () => {
    const task = await createTask("Pairing");
    await start(owner, task.id);
    await start(editor, task.id);
    expect((await running(owner))!.taskId).toBe(task.id);
    expect((await running(editor))!.taskId).toBe(task.id);
    await harness.request("/api/time/stop", { method: "POST", session: owner });
    await harness.request("/api/time/stop", { method: "POST", session: editor });
  });

  it("stopping with nothing running is harmless", async () => {
    const response = await harness.request("/api/time/stop", {
      method: "POST",
      session: viewer,
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { entry: null }).entry).toBeNull();
  });

  it("keeps viewers from tracking time", async () => {
    const task = await createTask();
    expect((await start(viewer, task.id)).status).toBe(403);
  });

  it("adds time by hand, on a chosen day", async () => {
    const task = await createTask("Manual");
    const response = await harness.request(`/api/tasks/${task.id}/time`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ minutes: 45, date: "2026-03-10", note: "Design review" }),
    });
    expect(response.status).toBe(201);
    const { entry } = (await response.json()) as { entry: TimeEntry };
    expect(entry.note).toBe("Design review");
    expect(entry.endedAt).toBe("2026-03-10T12:00:00.000Z");
    expect(new Date(entry.endedAt!).getTime() - new Date(entry.startedAt).getTime()).toBe(
      45 * 60_000
    );
  });

  it("rejects a zero or absurd amount", async () => {
    const task = await createTask();
    for (const minutes of [0, 24 * 60 + 1, 1.5]) {
      const response = await harness.request(`/api/tasks/${task.id}/time`, {
        method: "POST",
        session: owner,
        body: JSON.stringify({ minutes }),
      });
      expect(response.status).toBe(400);
    }
  });

  it("lets people delete their own entries, and the owner anyone's", async () => {
    const task = await createTask("Deletions");
    const add = async (session: Session) => {
      const response = await harness.request(`/api/tasks/${task.id}/time`, {
        method: "POST",
        session,
        body: JSON.stringify({ minutes: 10 }),
      });
      return ((await response.json()) as { entry: TimeEntry }).entry;
    };
    const ownerEntry = await add(owner);
    const editorEntry = await add(editor);

    const byEditor = await harness.request(`/api/tasks/${task.id}/time/${ownerEntry.id}`, {
      method: "DELETE",
      session: editor,
    });
    expect(byEditor.status).toBe(403);

    const byOwner = await harness.request(`/api/tasks/${task.id}/time/${editorEntry.id}`, {
      method: "DELETE",
      session: owner,
    });
    expect(byOwner.status).toBe(204);
    expect((await entries(task.id)).map((entry) => entry.id)).toEqual([ownerEntry.id]);
  });

  it("stores and clears an estimate on the task", async () => {
    const task = await createTask("Estimated");
    const set = await harness.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ estimateMinutes: 90 }),
    });
    expect(((await set.json()) as { task: Task }).task.estimateMinutes).toBe(90);

    const cleared = await harness.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ estimateMinutes: null }),
    });
    expect(((await cleared.json()) as { task: Task }).task.estimateMinutes).toBeNull();
  });

  it("reports totals per task and per person", async () => {
    const task = await createTask("Reported");
    for (const [session, minutes] of [
      [owner, 30],
      [editor, 15],
      [owner, 15],
    ] as const) {
      await harness.request(`/api/tasks/${task.id}/time`, {
        method: "POST",
        session,
        body: JSON.stringify({ minutes }),
      });
    }

    const response = await harness.request(`/api/boards/${owner.boardId}/time`, {
      session: viewer,
    });
    const report = (await response.json()) as {
      byTask: { taskId: string; seconds: number }[];
      byPerson: { name: string; seconds: number }[];
    };
    expect(report.byTask.find((row) => row.taskId === task.id)?.seconds).toBe(60 * 60);
    const editorTotal = report.byPerson.find((row) => row.name === "Editor")?.seconds ?? 0;
    expect(editorTotal).toBeGreaterThanOrEqual(15 * 60);
  });

  it("goes with the task when it is deleted", async () => {
    const task = await createTask("Doomed");
    await harness.request(`/api/tasks/${task.id}/time`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ minutes: 5 }),
    });
    await harness.request(`/api/tasks/${task.id}`, { method: "DELETE", session: owner });
    const response = await harness.request(`/api/tasks/${task.id}/time`, { session: owner });
    expect(response.status).toBe(404);
  });
});
