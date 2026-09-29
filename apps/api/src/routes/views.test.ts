import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SavedView } from "@auralis/shared";
import { createHarness, signUp, type Session, type TestHarness } from "../test/harness.js";

describe("saved views", () => {
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

  async function save(session: Session, body: Record<string, unknown>) {
    return harness.request(`/api/boards/${owner.boardId}/views`, {
      method: "POST",
      session,
      body: JSON.stringify({ filters: {}, ...body }),
    });
  }

  async function list(session: Session): Promise<SavedView[]> {
    const response = await harness.request(`/api/boards/${owner.boardId}/views`, { session });
    return ((await response.json()) as { views: SavedView[] }).views;
  }

  it("saves filters and sort, filling in defaults", async () => {
    const response = await save(owner, {
      name: "Urgent work",
      filters: { priorities: ["urgent"], overdueOnly: true },
      sortBy: "dueDate",
      sortDirection: "desc",
    });
    expect(response.status).toBe(201);
    const { view } = (await response.json()) as { view: SavedView };
    expect(view).toMatchObject({
      name: "Urgent work",
      sortBy: "dueDate",
      sortDirection: "desc",
      shared: false,
      ownerName: "Owner",
    });
    expect(view.filters).toEqual({
      search: "",
      priorities: ["urgent"],
      statuses: [],
      assigneeIds: [],
      labelIds: [],
      dueFrom: null,
      dueTo: null,
      overdueOnly: true,
    });
  });

  it("rejects malformed filters", async () => {
    const response = await save(owner, { name: "Broken", filters: { priorities: ["huge"] } });
    expect(response.status).toBe(400);
  });

  it("keeps a personal view to its owner", async () => {
    await save(editor, { name: "Only mine" });
    expect((await list(editor)).map((view) => view.name)).toContain("Only mine");
    expect((await list(owner)).map((view) => view.name)).not.toContain("Only mine");
  });

  it("shows a shared view to everyone on the board", async () => {
    await save(editor, { name: "Team triage", shared: true });
    for (const session of [owner, editor, viewer]) {
      expect((await list(session)).map((view) => view.name)).toContain("Team triage");
    }
  });

  it("lets a viewer keep private views but not share one", async () => {
    expect((await save(viewer, { name: "Viewer private" })).status).toBe(201);
    expect((await save(viewer, { name: "Viewer shared", shared: true })).status).toBe(403);
  });

  it("refuses a duplicate name for the same person only", async () => {
    expect((await save(owner, { name: "Duplicate" })).status).toBe(201);
    expect((await save(owner, { name: "DUPLICATE" })).status).toBe(409);
    expect((await save(editor, { name: "Duplicate" })).status).toBe(201);
  });

  it("lets only the creator rename a view", async () => {
    const created = (await (
      await save(editor, { name: "Rename me", shared: true })
    ).json()) as {
      view: SavedView;
    };
    const url = `/api/boards/${owner.boardId}/views/${created.view.id}`;

    const byOwner = await harness.request(url, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(byOwner.status).toBe(403);

    const byCreator = await harness.request(url, {
      method: "PATCH",
      session: editor,
      body: JSON.stringify({ name: "Renamed", filters: { statuses: ["review"] } }),
    });
    expect(byCreator.status).toBe(200);
    const { view } = (await byCreator.json()) as { view: SavedView };
    expect(view.name).toBe("Renamed");
    expect(view.filters.statuses).toEqual(["review"]);
  });

  it("lets the board owner remove a shared view, but not reach a private one", async () => {
    const shared = (await (
      await save(editor, { name: "Shared cleanup", shared: true })
    ).json()) as {
      view: SavedView;
    };
    const personal = (await (await save(editor, { name: "Private cleanup" })).json()) as {
      view: SavedView;
    };

    const removeShared = await harness.request(
      `/api/boards/${owner.boardId}/views/${shared.view.id}`,
      { method: "DELETE", session: owner }
    );
    expect(removeShared.status).toBe(204);

    const removePrivate = await harness.request(
      `/api/boards/${owner.boardId}/views/${personal.view.id}`,
      { method: "DELETE", session: owner }
    );
    expect(removePrivate.status).toBe(404);
  });

  it("tells the board when a shared view changes, and stays quiet about private ones", async () => {
    const received: string[] = [];
    const unsubscribe = harness.hub.subscribe({
      id: "views-watcher",
      boardId: owner.boardId,
      userId: owner.userId,
      name: "Owner",
      color: "#000",
      send: (message) => received.push(message.type),
    });
    await save(editor, { name: "Quiet" });
    expect(received).not.toContain("views.changed");
    await save(editor, { name: "Loud", shared: true });
    unsubscribe();
    expect(received).toContain("views.changed");
  });
});
