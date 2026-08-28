import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHarness,
  signInAsGuest,
  signUp,
  type Session,
  type TestHarness,
} from "../test/harness.js";
import type { Task } from "@auralis/shared";

describe("tasks", () => {
  let harness: TestHarness;
  let owner: Session;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness, { name: "Owner" });
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  async function createTask(
    session: Session,
    body: Record<string, unknown> = {}
  ): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session,
      body: JSON.stringify({ boardId: session.boardId, title: "A task", ...body }),
    });
    if (response.status !== 201) {
      throw new Error(`createTask failed: ${response.status} ${await response.text()}`);
    }
    return ((await response.json()) as { task: Task }).task;
  }

  describe("create", () => {
    it("applies sensible defaults", async () => {
      const task = await createTask(owner, { title: "Defaults" });
      expect(task.status).toBe("todo");
      expect(task.priority).toBe("low");
      expect(task.description).toBe("");
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.position).toBeTruthy();
    });

    it("stores a due date as the exact calendar day given", async () => {
      const task = await createTask(owner, { title: "Dated", dueDate: "2026-01-01" });
      expect(task.dueDate).toBe("2026-01-01");
    });

    it("rejects a non-ISO due date", async () => {
      const response = await harness.request("/api/tasks", {
        method: "POST",
        session: owner,
        body: JSON.stringify({ boardId: owner.boardId, title: "Bad", dueDate: "26-08-2026" }),
      });
      expect(response.status).toBe(400);
    });

    it("rejects an empty title", async () => {
      const response = await harness.request("/api/tasks", {
        method: "POST",
        session: owner,
        body: JSON.stringify({ boardId: owner.boardId, title: "" }),
      });
      expect(response.status).toBe(400);
    });

    it("sets completedAt when created directly as completed", async () => {
      const task = await createTask(owner, { title: "Born done", status: "completed" });
      expect(task.completedAt).not.toBeNull();
    });

    it("honours a client-supplied id so optimistic inserts keep identity", async () => {
      const id = crypto.randomUUID();
      const task = await createTask(owner, { id, title: "Optimistic" });
      expect(task.id).toBe(id);
    });

    it("appends each new task after the last in its column", async () => {
      const a = await createTask(owner, { title: "First", status: "review" });
      const b = await createTask(owner, { title: "Second", status: "review" });
      const c = await createTask(owner, { title: "Third", status: "review" });
      expect(a.position < b.position).toBe(true);
      expect(b.position < c.position).toBe(true);
    });
  });

  describe("update", () => {
    it("stamps completedAt on completion and clears it on reopen", async () => {
      const task = await createTask(owner, { title: "Lifecycle" });

      const completed = await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ status: "completed" }),
      });
      const done = ((await completed.json()) as { task: Task }).task;
      expect(done.completedAt).not.toBeNull();

      const reopened = await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ status: "todo" }),
      });
      const open = ((await reopened.json()) as { task: Task }).task;
      expect(open.completedAt).toBeNull();
    });

    it("accepts an empty patch without changing anything", async () => {
      const task = await createTask(owner, { title: "Untouched" });
      const response = await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);
      const after = ((await response.json()) as { task: Task }).task;
      expect(after.title).toBe("Untouched");
    });

    it("rejects an unknown status", async () => {
      const task = await createTask(owner, { title: "Enum" });
      const response = await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ status: "archived" }),
      });
      expect(response.status).toBe(400);
    });

    it("404s on a task that does not exist", async () => {
      const response = await harness.request(`/api/tasks/${crypto.randomUUID()}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ title: "Ghost" }),
      });
      expect(response.status).toBe(404);
    });

    it("refuses to make a task its own parent", async () => {
      const task = await createTask(owner, { title: "Self" });
      const response = await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ parentId: task.id }),
      });
      expect(response.status).toBe(400);
    });

    it("refuses to create a cycle in the subtask tree", async () => {
      const parent = await createTask(owner, { title: "Parent" });
      const child = await createTask(owner, { title: "Child", parentId: parent.id });

      // Making the parent a child of its own child would close a loop.
      const response = await harness.request(`/api/tasks/${parent.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ parentId: child.id }),
      });
      expect(response.status).toBe(409);
    });
  });

  describe("delete", () => {
    it("removes the task", async () => {
      const task = await createTask(owner, { title: "Doomed" });
      const deleted = await harness.request(`/api/tasks/${task.id}`, {
        method: "DELETE",
        session: owner,
      });
      expect(deleted.status).toBe(204);

      const after = await harness.request(`/api/tasks/${task.id}`, { session: owner });
      expect(after.status).toBe(404);
    });

    it("keeps the activity record after the task is gone", async () => {
      const task = await createTask(owner, { title: "Remembered" });
      await harness.request(`/api/tasks/${task.id}`, { method: "DELETE", session: owner });

      // The task is gone, so the activity endpoint 404s — but the row survives
      // for the board timeline. Assert it directly.
      const rows = await harness.handle.db.query.activities.findMany();
      expect(rows.some((row) => row.taskId === task.id && row.kind === "task.deleted")).toBe(
        true
      );
    });
  });

  describe("bulk operations", () => {
    it("updates many tasks at once", async () => {
      const a = await createTask(owner, { title: "Bulk A" });
      const b = await createTask(owner, { title: "Bulk B" });

      const response = await harness.request("/api/tasks/bulk", {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ ids: [a.id, b.id], updates: { priority: "urgent" } }),
      });

      expect(response.status).toBe(200);
      const { tasks } = (await response.json()) as { tasks: Task[] };
      expect(tasks).toHaveLength(2);
      expect(tasks.every((task) => task.priority === "urgent")).toBe(true);
    });

    it("routes /bulk to the bulk handler rather than treating it as an id", async () => {
      const response = await harness.request("/api/tasks/bulk", {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ ids: [], updates: {} }),
      });
      // A validation error from the bulk schema (min 1 id), not a uuid param error.
      expect(response.status).toBe(400);
    });

    it("refuses to set position across multiple tasks", async () => {
      const a = await createTask(owner, { title: "Pos A" });
      const response = await harness.request("/api/tasks/bulk", {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ ids: [a.id], updates: { position: "a0V" } }),
      });
      expect(response.status).toBe(400);
    });

    it("deletes many tasks at once", async () => {
      const a = await createTask(owner, { title: "Del A" });
      const b = await createTask(owner, { title: "Del B" });

      const response = await harness.request("/api/tasks/bulk-delete", {
        method: "POST",
        session: owner,
        body: JSON.stringify({ ids: [a.id, b.id] }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: 2 });
    });
  });

  describe("authorisation", () => {
    it("refuses to list another user's board", async () => {
      const stranger = await signUp(harness, { name: "Stranger" });
      const response = await harness.request(`/api/tasks?boardId=${owner.boardId}`, {
        session: stranger,
      });
      expect(response.status).toBe(403);
    });

    it("refuses to create a task on another user's board", async () => {
      const stranger = await signUp(harness, { name: "Stranger 2" });
      const response = await harness.request("/api/tasks", {
        method: "POST",
        session: stranger,
        body: JSON.stringify({ boardId: owner.boardId, title: "Intrusion" }),
      });
      expect(response.status).toBe(403);
    });

    it("refuses to read another user's task by id", async () => {
      const task = await createTask(owner, { title: "Private" });
      const stranger = await signUp(harness, { name: "Stranger 3" });
      const response = await harness.request(`/api/tasks/${task.id}`, { session: stranger });
      expect(response.status).toBe(403);
    });

    it("refuses to update another user's task", async () => {
      const task = await createTask(owner, { title: "Private 2" });
      const stranger = await signUp(harness, { name: "Stranger 4" });
      const response = await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: stranger,
        body: JSON.stringify({ title: "Defaced" }),
      });
      expect(response.status).toBe(403);
    });

    it("refuses to delete another user's task", async () => {
      const task = await createTask(owner, { title: "Private 3" });
      const stranger = await signUp(harness, { name: "Stranger 5" });
      const response = await harness.request(`/api/tasks/${task.id}`, {
        method: "DELETE",
        session: stranger,
      });
      expect(response.status).toBe(403);
    });

    it("does not let a bulk update reach across board boundaries", async () => {
      const mine = await createTask(owner, { title: "Mine" });
      const stranger = await signUp(harness, { name: "Stranger 6" });
      const theirs = await createTask(stranger, { title: "Theirs" });

      // A selection mixing both boards must be rejected wholesale, not
      // partially applied to the tasks the caller happens to own.
      const response = await harness.request("/api/tasks/bulk", {
        method: "PATCH",
        session: stranger,
        body: JSON.stringify({ ids: [mine.id, theirs.id], updates: { priority: "urgent" } }),
      });
      expect(response.status).toBe(403);

      const after = await harness.request(`/api/tasks/${mine.id}`, { session: owner });
      const { task } = (await after.json()) as { task: Task };
      expect(task.priority).not.toBe("urgent");
    });

    it("requires authentication for every task route", async () => {
      const routes: [string, string][] = [
        ["GET", `/api/tasks?boardId=${owner.boardId}`],
        ["POST", "/api/tasks"],
        ["PATCH", `/api/tasks/${crypto.randomUUID()}`],
        ["DELETE", `/api/tasks/${crypto.randomUUID()}`],
        ["PATCH", "/api/tasks/bulk"],
        ["POST", "/api/tasks/bulk-delete"],
      ];

      for (const [method, path] of routes) {
        const response = await harness.request(path, {
          method,
          ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify({}) }),
        });
        expect(response.status, `${method} ${path}`).toBe(401);
      }
    });
  });

  describe("activity log", () => {
    it("records creation and subsequent edits", async () => {
      const task = await createTask(owner, { title: "Tracked" });
      await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ priority: "high" }),
      });

      const response = await harness.request(`/api/tasks/${task.id}/activity`, {
        session: owner,
      });
      const { activity } = (await response.json()) as {
        activity: { kind: string; payload: Record<string, unknown> }[];
      };

      const kinds = activity.map((entry) => entry.kind);
      expect(kinds).toContain("task.created");
      expect(kinds).toContain("task.updated");

      const edit = activity.find((entry) => entry.kind === "task.updated")!;
      expect(edit.payload).toMatchObject({ priority: { from: "low", to: "high" } });
    });

    it("labels a status change as a move and a completion as a completion", async () => {
      const task = await createTask(owner, { title: "Moves" });
      await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ status: "inprogress" }),
      });
      await harness.request(`/api/tasks/${task.id}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ status: "completed" }),
      });

      const response = await harness.request(`/api/tasks/${task.id}/activity`, {
        session: owner,
      });
      const { activity } = (await response.json()) as { activity: { kind: string }[] };
      const kinds = activity.map((entry) => entry.kind);
      expect(kinds).toContain("task.moved");
      expect(kinds).toContain("task.completed");
    });
  });

  describe("seeded demo board", () => {
    it("gives a guest a board with overdue, due-today and upcoming work", async () => {
      const guest = await signInAsGuest(harness);
      const response = await harness.request(`/api/tasks?boardId=${guest.boardId}`, {
        session: guest,
      });
      const { tasks } = (await response.json()) as { tasks: Task[] };

      const today = new Date().toISOString().slice(0, 10);
      const open = tasks.filter((task) => task.status !== "completed" && task.dueDate);

      expect(open.some((task) => task.dueDate! < today)).toBe(true);
      expect(open.some((task) => task.dueDate === today)).toBe(true);
      expect(open.some((task) => task.dueDate! > today)).toBe(true);
      expect(new Set(tasks.map((task) => task.status)).size).toBe(4);
    });
  });
});

describe("the seeded demo board", () => {
  let harness: TestHarness;
  let guest: Session;

  beforeAll(async () => {
    harness = await createHarness();
    guest = await signInAsGuest(harness);
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  it("backdates creation so the ageing chart is not one bucket", async () => {
    const response = await harness.request(`/api/tasks?boardId=${guest.boardId}`, {
      session: guest,
    });
    const { tasks } = (await response.json()) as { tasks: Task[] };

    const ages = tasks.map((task) =>
      Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 86_400_000)
    );
    // Spread across more than one of the UI's age buckets.
    expect(Math.max(...ages)).toBeGreaterThan(14);
    expect(Math.min(...ages)).toBeLessThan(4);
  });

  it("reports a non-zero time to completion", async () => {
    const response = await harness.request(`/api/tasks?boardId=${guest.boardId}`, {
      session: guest,
    });
    const { tasks } = (await response.json()) as { tasks: Task[] };

    const done = tasks.filter((task) => task.status === "completed");
    expect(done.length).toBeGreaterThan(0);
    for (const task of done) {
      expect(task.completedAt).not.toBeNull();
      // Completed after it was created, and not in the future.
      expect(new Date(task.completedAt!).getTime()).toBeGreaterThan(
        new Date(task.createdAt).getTime()
      );
      expect(new Date(task.completedAt!).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  it("gives every seeded task a creation entry in its history", async () => {
    const response = await harness.request(`/api/tasks?boardId=${guest.boardId}`, {
      session: guest,
    });
    const { tasks } = (await response.json()) as { tasks: Task[] };

    const first = tasks[0]!;
    const activityResponse = await harness.request(`/api/tasks/${first.id}/activity`, {
      session: guest,
    });
    const { activity } = (await activityResponse.json()) as { activity: { kind: string }[] };

    // An empty history panel on the demo board shows the feature not working.
    expect(activity.map((entry) => entry.kind)).toContain("task.created");
  });
});

describe("dependencies", () => {
  let harness: TestHarness;
  let owner: Session;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness, { name: "Dep Owner" });
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  async function make(title: string): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ boardId: owner.boardId, title }),
    });
    return ((await response.json()) as { task: Task }).task;
  }

  async function block(blockedId: string, blockerId: string) {
    return harness.request(`/api/tasks/${blockedId}/dependencies`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ blockerId }),
    });
  }

  it("records what a task is waiting on, in both directions", async () => {
    const api = await make("Build the API");
    const ui = await make("Build the UI");

    expect((await block(ui.id, api.id)).status).toBe(201);

    const forward = await harness.request(`/api/tasks/${ui.id}/dependencies`, {
      session: owner,
    });
    const forwardBody = (await forward.json()) as { blockedBy: Task[]; blocking: Task[] };
    expect(forwardBody.blockedBy.map((task) => task.id)).toEqual([api.id]);
    expect(forwardBody.blocking).toEqual([]);

    const reverse = await harness.request(`/api/tasks/${api.id}/dependencies`, {
      session: owner,
    });
    const reverseBody = (await reverse.json()) as { blockedBy: Task[]; blocking: Task[] };
    expect(reverseBody.blocking.map((task) => task.id)).toEqual([ui.id]);
  });

  it("refuses to let a task block itself", async () => {
    const task = await make("Self blocker");
    expect((await block(task.id, task.id)).status).toBe(400);
  });

  it("refuses a direct cycle", async () => {
    const a = await make("Cycle A");
    const b = await make("Cycle B");

    expect((await block(b.id, a.id)).status).toBe(201);
    // b already waits on a, so a waiting on b would deadlock the pair.
    expect((await block(a.id, b.id)).status).toBe(409);
  });

  it("refuses an indirect cycle three tasks long", async () => {
    const a = await make("Chain A");
    const b = await make("Chain B");
    const c = await make("Chain C");

    expect((await block(b.id, a.id)).status).toBe(201);
    expect((await block(c.id, b.id)).status).toBe(201);
    // a → b → c, so c blocking a closes the loop.
    expect((await block(a.id, c.id)).status).toBe(409);
  });

  it("allows a diamond, which is not a cycle", async () => {
    const root = await make("Diamond root");
    const left = await make("Diamond left");
    const right = await make("Diamond right");
    const join = await make("Diamond join");

    expect((await block(left.id, root.id)).status).toBe(201);
    expect((await block(right.id, root.id)).status).toBe(201);
    expect((await block(join.id, left.id)).status).toBe(201);
    expect((await block(join.id, right.id)).status).toBe(201);
  });

  it("treats adding the same edge twice as a no-op", async () => {
    const a = await make("Idempotent A");
    const b = await make("Idempotent B");

    expect((await block(b.id, a.id)).status).toBe(201);
    expect((await block(b.id, a.id)).status).toBe(201);

    const response = await harness.request(`/api/tasks/${b.id}/dependencies`, {
      session: owner,
    });
    const body = (await response.json()) as { blockedBy: Task[] };
    expect(body.blockedBy).toHaveLength(1);
  });

  it("removes an edge", async () => {
    const a = await make("Removable A");
    const b = await make("Removable B");
    await block(b.id, a.id);

    const deleted = await harness.request(`/api/tasks/${b.id}/dependencies/${a.id}`, {
      method: "DELETE",
      session: owner,
    });
    expect(deleted.status).toBe(204);

    const response = await harness.request(`/api/tasks/${b.id}/dependencies`, {
      session: owner,
    });
    expect(((await response.json()) as { blockedBy: Task[] }).blockedBy).toEqual([]);
  });

  it("refuses to link tasks on different boards", async () => {
    const mine = await make("Mine");
    const stranger = await signUp(harness, { name: "Dep Stranger" });
    const theirsResponse = await harness.request("/api/tasks", {
      method: "POST",
      session: stranger,
      body: JSON.stringify({ boardId: stranger.boardId, title: "Theirs" }),
    });
    const theirs = ((await theirsResponse.json()) as { task: Task }).task;

    const response = await block(mine.id, theirs.id);
    // The blocker is on a board the caller cannot read at all.
    expect([400, 403]).toContain(response.status);
  });

  it("drops the edge when a task is deleted", async () => {
    const a = await make("Doomed blocker");
    const b = await make("Survivor");
    await block(b.id, a.id);

    await harness.request(`/api/tasks/${a.id}`, { method: "DELETE", session: owner });

    const response = await harness.request(`/api/tasks/${b.id}/dependencies`, {
      session: owner,
    });
    expect(((await response.json()) as { blockedBy: Task[] }).blockedBy).toEqual([]);
  });

  it("requires authentication", async () => {
    const task = await make("Private deps");
    const response = await harness.request(`/api/tasks/${task.id}/dependencies`);
    expect(response.status).toBe(401);
  });
});
