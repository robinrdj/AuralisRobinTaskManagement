import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Label, LabelAssignment, Task } from "@auralis/shared";
import { createHarness, signUp, type Session, type TestHarness } from "../test/harness.js";

describe("labels", () => {
  let harness: TestHarness;
  let owner: Session;
  let viewer: Session;
  let stranger: Session;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness);
    stranger = await signUp(harness);
    const viewerEmail = `v-${Math.random().toString(36).slice(2)}@example.com`;
    viewer = await signUp(harness, { email: viewerEmail });
    await harness.request(`/api/boards/${owner.boardId}/members`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ email: viewerEmail, role: "viewer" }),
    });
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  async function createLabel(session: Session, boardId: string, name: string) {
    return harness.request(`/api/boards/${boardId}/labels`, {
      method: "POST",
      session,
      body: JSON.stringify({ name, color: "#2563eb" }),
    });
  }

  async function label(name: string): Promise<Label> {
    const response = await createLabel(owner, owner.boardId, name);
    expect(response.status).toBe(201);
    return ((await response.json()) as { label: Label }).label;
  }

  async function createTask(boardId = owner.boardId, session = owner): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session,
      body: JSON.stringify({ boardId, title: "Tagged" }),
    });
    return ((await response.json()) as { task: Task }).task;
  }

  async function setLabels(taskId: string, labelIds: string[], session = owner) {
    return harness.request(`/api/tasks/${taskId}/labels`, {
      method: "PUT",
      session,
      body: JSON.stringify({ labelIds }),
    });
  }

  async function boardLabels(session = owner) {
    const response = await harness.request(`/api/boards/${owner.boardId}/labels`, { session });
    return (await response.json()) as { labels: Label[]; assignments: LabelAssignment[] };
  }

  it("creates labels and lists them by name", async () => {
    await label("zeta");
    await label("alpha");
    const names = (await boardLabels()).labels.map((entry) => entry.name);
    expect(names.indexOf("alpha")).toBeLessThan(names.indexOf("zeta"));
  });

  it("refuses a duplicate name regardless of case", async () => {
    await label("Bug");
    const response = await createLabel(owner, owner.boardId, "bug");
    expect(response.status).toBe(409);
  });

  it("rejects a colour that is not a hex code", async () => {
    const response = await harness.request(`/api/boards/${owner.boardId}/labels`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ name: "Oops", color: "red" }),
    });
    expect(response.status).toBe(400);
  });

  it("lets a viewer read labels but not create them", async () => {
    expect((await createLabel(viewer, owner.boardId, "Nope")).status).toBe(403);
    const response = await harness.request(`/api/boards/${owner.boardId}/labels`, {
      session: viewer,
    });
    expect(response.status).toBe(200);
  });

  it("assigns and replaces a task's labels, recording the change", async () => {
    const task = await createTask();
    const design = await label("Design");
    const backend = await label("Backend");

    expect((await setLabels(task.id, [design.id, backend.id])).status).toBe(200);
    let assigned = (await boardLabels()).assignments.filter((a) => a.taskId === task.id);
    expect(assigned.map((a) => a.labelId).sort()).toEqual([design.id, backend.id].sort());

    await setLabels(task.id, [backend.id]);
    assigned = (await boardLabels()).assignments.filter((a) => a.taskId === task.id);
    expect(assigned.map((a) => a.labelId)).toEqual([backend.id]);

    const history = await harness.request(`/api/tasks/${task.id}/activity`, { session: owner });
    const { activity } = (await history.json()) as {
      activity: { payload: Record<string, { from: string[]; to: string[] }> }[];
    };
    expect(activity[0]!.payload.labels).toEqual({
      from: ["Backend", "Design"],
      to: ["Backend"],
    });
  });

  it("refuses a label from another board", async () => {
    const task = await createTask();
    const foreign = await createLabel(stranger, stranger.boardId, "Theirs");
    const { label: theirs } = (await foreign.json()) as { label: Label };

    expect((await setLabels(task.id, [theirs.id])).status).toBe(400);
  });

  it("renames and recolours a label", async () => {
    const original = await label("Rename me");
    const response = await harness.request(
      `/api/boards/${owner.boardId}/labels/${original.id}`,
      {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ name: "Renamed", color: "#dc2626" }),
      }
    );
    expect(response.status).toBe(200);
    const updated = (await boardLabels()).labels.find((entry) => entry.id === original.id);
    expect(updated).toMatchObject({ name: "Renamed", color: "#dc2626" });
  });

  it("removes a deleted label from every task", async () => {
    const task = await createTask();
    const doomed = await label("Doomed");
    await setLabels(task.id, [doomed.id]);

    const response = await harness.request(`/api/boards/${owner.boardId}/labels/${doomed.id}`, {
      method: "DELETE",
      session: owner,
    });
    expect(response.status).toBe(204);
    const { assignments } = await boardLabels();
    expect(assignments.some((entry) => entry.labelId === doomed.id)).toBe(false);
  });

  it("cannot reach another board's label through this board's URL", async () => {
    const foreign = await createLabel(stranger, stranger.boardId, "Private");
    const { label: theirs } = (await foreign.json()) as { label: Label };

    const response = await harness.request(`/api/boards/${owner.boardId}/labels/${theirs.id}`, {
      method: "DELETE",
      session: owner,
    });
    expect(response.status).toBe(404);
  });
});
