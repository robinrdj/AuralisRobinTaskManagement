import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatMention, type Comment, type Task } from "@auralis/shared";
import { createHarness, signUp, type Session, type TestHarness } from "../test/harness.js";

describe("comments", () => {
  let harness: TestHarness;
  let owner: Session;
  let editor: Session;
  let viewer: Session;
  let outsider: Session;

  const email = () => `c-${Math.random().toString(36).slice(2)}@example.com`;

  beforeAll(async () => {
    harness = await createHarness();
    owner = await signUp(harness, { name: "Owner" });

    const editorEmail = email();
    const viewerEmail = email();
    editor = await signUp(harness, { email: editorEmail, name: "Editor" });
    viewer = await signUp(harness, { email: viewerEmail, name: "Viewer" });
    outsider = await signUp(harness, { name: "Outsider" });

    for (const [address, role] of [
      [editorEmail, "editor"],
      [viewerEmail, "viewer"],
    ] as const) {
      await harness.request(`/api/boards/${owner.boardId}/members`, {
        method: "POST",
        session: owner,
        body: JSON.stringify({ email: address, role }),
      });
    }
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  async function createTask(): Promise<Task> {
    const response = await harness.request("/api/tasks", {
      method: "POST",
      session: owner,
      body: JSON.stringify({ boardId: owner.boardId, title: "Discuss me" }),
    });
    return ((await response.json()) as { task: Task }).task;
  }

  async function comment(session: Session, taskId: string, body: string) {
    return harness.request(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      session,
      body: JSON.stringify({ body }),
    });
  }

  async function list(session: Session, taskId: string): Promise<Comment[]> {
    const response = await harness.request(`/api/tasks/${taskId}/comments`, { session });
    return ((await response.json()) as { comments: Comment[] }).comments;
  }

  it("adds a comment with its author, oldest first", async () => {
    const task = await createTask();
    expect((await comment(owner, task.id, "First")).status).toBe(201);
    expect((await comment(editor, task.id, "Second")).status).toBe(201);

    const thread = await list(viewer, task.id);
    expect(thread.map((entry) => [entry.body, entry.authorName])).toEqual([
      ["First", "Owner"],
      ["Second", "Editor"],
    ]);
    expect(thread[0]!.editedAt).toBeNull();
  });

  it("records the comment in the task's history", async () => {
    const task = await createTask();
    await comment(owner, task.id, "Noted");

    const response = await harness.request(`/api/tasks/${task.id}/activity`, {
      session: owner,
    });
    const { activity } = (await response.json()) as { activity: { kind: string }[] };
    expect(activity.map((entry) => entry.kind)).toContain("comment.added");
  });

  it("rejects an empty comment", async () => {
    const task = await createTask();
    expect((await comment(owner, task.id, "   ")).status).toBe(400);
  });

  it("keeps viewers and outsiders from commenting", async () => {
    const task = await createTask();
    expect((await comment(viewer, task.id, "Can I?")).status).toBe(403);
    expect((await comment(outsider, task.id, "Can I?")).status).toBe(403);

    const read = await harness.request(`/api/tasks/${task.id}/comments`, {
      session: outsider,
    });
    expect(read.status).toBe(403);
  });

  it("reports only mentioned people who are on the board, never the author", async () => {
    const task = await createTask();
    const body = [
      formatMention("Editor", editor.userId),
      formatMention("Outsider", outsider.userId),
      formatMention("Owner", owner.userId),
    ].join(" ");

    const response = await comment(owner, task.id, body);
    const { mentioned } = (await response.json()) as { mentioned: string[] };
    expect(mentioned).toEqual([editor.userId]);
  });

  it("lets the author edit, marking it edited, and nobody else", async () => {
    const task = await createTask();
    const created = await comment(editor, task.id, "Tpyo");
    const { comment: original } = (await created.json()) as { comment: Comment };

    const byOwner = await harness.request(`/api/tasks/${task.id}/comments/${original.id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({ body: "Rewritten" }),
    });
    expect(byOwner.status).toBe(403);

    const byAuthor = await harness.request(`/api/tasks/${task.id}/comments/${original.id}`, {
      method: "PATCH",
      session: editor,
      body: JSON.stringify({ body: "Typo" }),
    });
    expect(byAuthor.status).toBe(200);
    const { comment: edited } = (await byAuthor.json()) as { comment: Comment };
    expect(edited.body).toBe("Typo");
    expect(edited.editedAt).not.toBeNull();
  });

  it("only reports people newly mentioned by an edit", async () => {
    const task = await createTask();
    const created = await comment(owner, task.id, formatMention("Editor", editor.userId));
    const { comment: original } = (await created.json()) as { comment: Comment };

    const edited = await harness.request(`/api/tasks/${task.id}/comments/${original.id}`, {
      method: "PATCH",
      session: owner,
      body: JSON.stringify({
        body: `${formatMention("Editor", editor.userId)} and ${formatMention("Viewer", viewer.userId)}`,
      }),
    });
    const { mentioned } = (await edited.json()) as { mentioned: string[] };
    expect(mentioned).toEqual([viewer.userId]);
  });

  it("lets the author or the board owner delete, but not another member", async () => {
    const task = await createTask();
    const first = (await (await comment(editor, task.id, "One")).json()) as {
      comment: Comment;
    };
    const second = (await (await comment(owner, task.id, "Two")).json()) as {
      comment: Comment;
    };

    const byOtherMember = await harness.request(
      `/api/tasks/${task.id}/comments/${second.comment.id}`,
      { method: "DELETE", session: editor }
    );
    expect(byOtherMember.status).toBe(403);

    const byOwner = await harness.request(
      `/api/tasks/${task.id}/comments/${first.comment.id}`,
      { method: "DELETE", session: owner }
    );
    expect(byOwner.status).toBe(204);
    expect((await list(owner, task.id)).map((entry) => entry.body)).toEqual(["Two"]);
  });

  it("will not reach a comment through a different task's URL", async () => {
    const task = await createTask();
    const other = await createTask();
    const created = (await (await comment(owner, task.id, "Here")).json()) as {
      comment: Comment;
    };

    const response = await harness.request(
      `/api/tasks/${other.id}/comments/${created.comment.id}`,
      { method: "DELETE", session: owner }
    );
    expect(response.status).toBe(404);
  });

  it("disappears with its task", async () => {
    const task = await createTask();
    await comment(owner, task.id, "Soon gone");
    await harness.request(`/api/tasks/${task.id}`, { method: "DELETE", session: owner });

    const response = await harness.request(`/api/tasks/${task.id}/comments`, {
      session: owner,
    });
    expect(response.status).toBe(404);
  });

  it("tells clients watching the board", async () => {
    const task = await createTask();
    const received: string[] = [];
    const unsubscribe = harness.hub.subscribe({
      id: "comment-watcher",
      boardId: owner.boardId,
      userId: editor.userId,
      name: "Editor",
      color: "#000",
      send: (message) => received.push(message.type),
    });
    await comment(owner, task.id, "Ping");
    unsubscribe();
    expect(received).toContain("comment.changed");
  });
});
