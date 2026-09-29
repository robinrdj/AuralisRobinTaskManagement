import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHarness,
  signInAsGuest,
  signUp,
  type Session,
  type TestHarness,
} from "../test/harness.js";

interface BoardSummary {
  id: string;
  name: string;
  role: string;
}

interface Member {
  userId: string;
  name: string;
  email: string | null;
  role: string;
}

describe("boards", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  const email = () => `member-${Math.random().toString(36).slice(2)}@example.com`;

  async function listBoards(session: Session): Promise<BoardSummary[]> {
    const response = await harness.request("/api/boards", { session });
    return ((await response.json()) as { boards: BoardSummary[] }).boards;
  }

  async function createBoard(session: Session, name = "Side project"): Promise<string> {
    const response = await harness.request("/api/boards", {
      method: "POST",
      session,
      body: JSON.stringify({ name }),
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as { board: { id: string } }).board.id;
  }

  async function invite(
    owner: Session,
    boardId: string,
    address: string,
    role: "editor" | "viewer" = "editor"
  ) {
    return harness.request(`/api/boards/${boardId}/members`, {
      method: "POST",
      session: owner,
      body: JSON.stringify({ email: address, role }),
    });
  }

  async function members(session: Session, boardId: string): Promise<Member[]> {
    const response = await harness.request(`/api/boards/${boardId}/members`, { session });
    return ((await response.json()) as { members: Member[] }).members;
  }

  describe("creating and renaming", () => {
    it("creates a second board owned by the caller", async () => {
      const owner = await signUp(harness);
      const id = await createBoard(owner, "Second");

      const boards = await listBoards(owner);
      expect(boards).toHaveLength(2);
      expect(boards.find((board) => board.id === id)).toMatchObject({
        name: "Second",
        role: "owner",
      });
    });

    it("rejects a blank name", async () => {
      const owner = await signUp(harness);
      const response = await harness.request("/api/boards", {
        method: "POST",
        session: owner,
        body: JSON.stringify({ name: "   " }),
      });
      expect(response.status).toBe(400);
    });

    it("lets the owner rename, and nobody else", async () => {
      const owner = await signUp(harness);
      const editorEmail = email();
      const editor = await signUp(harness, { email: editorEmail });
      await invite(owner, owner.boardId, editorEmail);

      const renamed = await harness.request(`/api/boards/${owner.boardId}`, {
        method: "PATCH",
        session: owner,
        body: JSON.stringify({ name: "Renamed" }),
      });
      expect(renamed.status).toBe(200);
      expect((await listBoards(owner)).find((b) => b.id === owner.boardId)?.name).toBe(
        "Renamed"
      );

      const refused = await harness.request(`/api/boards/${owner.boardId}`, {
        method: "PATCH",
        session: editor,
        body: JSON.stringify({ name: "Hijacked" }),
      });
      expect(refused.status).toBe(403);
    });
  });

  describe("deleting", () => {
    it("refuses to delete the owner's only board", async () => {
      const owner = await signUp(harness);
      const response = await harness.request(`/api/boards/${owner.boardId}`, {
        method: "DELETE",
        session: owner,
      });
      expect(response.status).toBe(400);
    });

    it("deletes a board and everything on it", async () => {
      const owner = await signUp(harness);
      const id = await createBoard(owner);
      await harness.request("/api/tasks", {
        method: "POST",
        session: owner,
        body: JSON.stringify({ boardId: id, title: "Goes with the board" }),
      });

      const response = await harness.request(`/api/boards/${id}`, {
        method: "DELETE",
        session: owner,
      });
      expect(response.status).toBe(204);
      expect((await listBoards(owner)).map((board) => board.id)).not.toContain(id);

      const tasks = await harness.request(`/api/tasks?boardId=${id}`, { session: owner });
      expect(tasks.status).toBe(403);
    });

    it("does not let a non-owner delete", async () => {
      const owner = await signUp(harness);
      const id = await createBoard(owner);
      const editorEmail = email();
      const editor = await signUp(harness, { email: editorEmail });
      await invite(owner, id, editorEmail);

      const response = await harness.request(`/api/boards/${id}`, {
        method: "DELETE",
        session: editor,
      });
      expect(response.status).toBe(403);
    });
  });

  describe("inviting", () => {
    it("adds an existing account, which then sees the board", async () => {
      const owner = await signUp(harness);
      const inviteeEmail = email();
      const invitee = await signUp(harness, { email: inviteeEmail, name: "Invitee" });

      const response = await invite(owner, owner.boardId, inviteeEmail.toUpperCase());
      expect(response.status).toBe(201);

      const boards = await listBoards(invitee);
      expect(boards.find((board) => board.id === owner.boardId)?.role).toBe("editor");

      const list = await members(owner, owner.boardId);
      expect(list.map((member) => member.name).sort()).toEqual(["Invitee", "Test User"]);
    });

    it("lets an invited editor create tasks on the shared board", async () => {
      const owner = await signUp(harness);
      const editorEmail = email();
      const editor = await signUp(harness, { email: editorEmail });
      await invite(owner, owner.boardId, editorEmail);

      const response = await harness.request("/api/tasks", {
        method: "POST",
        session: editor,
        body: JSON.stringify({ boardId: owner.boardId, title: "From a teammate" }),
      });
      expect(response.status).toBe(201);
    });

    it("keeps a viewer read-only", async () => {
      const owner = await signUp(harness);
      const viewerEmail = email();
      const viewer = await signUp(harness, { email: viewerEmail });
      await invite(owner, owner.boardId, viewerEmail, "viewer");

      const read = await harness.request(`/api/tasks?boardId=${owner.boardId}`, {
        session: viewer,
      });
      expect(read.status).toBe(200);

      const write = await harness.request("/api/tasks", {
        method: "POST",
        session: viewer,
        body: JSON.stringify({ boardId: owner.boardId, title: "Not allowed" }),
      });
      expect(write.status).toBe(403);
    });

    it("reports an unknown email as not found", async () => {
      const owner = await signUp(harness);
      const response = await invite(owner, owner.boardId, "nobody-here@example.com");
      expect(response.status).toBe(404);
    });

    it("cannot reach a guest account by its generated address", async () => {
      const owner = await signUp(harness);
      const guest = await signInAsGuest(harness);
      const response = await invite(
        owner,
        owner.boardId,
        `guest-${guest.userId}@guest.auralis.local`
      );
      expect(response.status).toBe(404);
    });

    it("refuses a duplicate invite", async () => {
      const owner = await signUp(harness);
      const inviteeEmail = email();
      await signUp(harness, { email: inviteeEmail });
      expect((await invite(owner, owner.boardId, inviteeEmail)).status).toBe(201);
      expect((await invite(owner, owner.boardId, inviteeEmail)).status).toBe(409);
    });

    it("only lets the owner invite", async () => {
      const owner = await signUp(harness);
      const editorEmail = email();
      const editor = await signUp(harness, { email: editorEmail });
      await invite(owner, owner.boardId, editorEmail);
      const thirdEmail = email();
      await signUp(harness, { email: thirdEmail });

      expect((await invite(editor, owner.boardId, thirdEmail)).status).toBe(403);
    });
  });

  describe("roles and removal", () => {
    it("lets the owner demote an editor to viewer", async () => {
      const owner = await signUp(harness);
      const memberEmail = email();
      const member = await signUp(harness, { email: memberEmail });
      await invite(owner, owner.boardId, memberEmail);

      const response = await harness.request(
        `/api/boards/${owner.boardId}/members/${member.userId}`,
        { method: "PATCH", session: owner, body: JSON.stringify({ role: "viewer" }) }
      );
      expect(response.status).toBe(200);

      const write = await harness.request("/api/tasks", {
        method: "POST",
        session: member,
        body: JSON.stringify({ boardId: owner.boardId, title: "Now refused" }),
      });
      expect(write.status).toBe(403);
    });

    it("never changes the owner's own role", async () => {
      const owner = await signUp(harness);
      const response = await harness.request(
        `/api/boards/${owner.boardId}/members/${owner.userId}`,
        { method: "PATCH", session: owner, body: JSON.stringify({ role: "viewer" }) }
      );
      expect(response.status).toBe(400);
    });

    it("lets the owner remove a member, who then loses access", async () => {
      const owner = await signUp(harness);
      const memberEmail = email();
      const member = await signUp(harness, { email: memberEmail });
      await invite(owner, owner.boardId, memberEmail);

      const response = await harness.request(
        `/api/boards/${owner.boardId}/members/${member.userId}`,
        { method: "DELETE", session: owner }
      );
      expect(response.status).toBe(204);

      const read = await harness.request(`/api/tasks?boardId=${owner.boardId}`, {
        session: member,
      });
      expect(read.status).toBe(403);
    });

    it("lets a member leave, but not remove anyone else", async () => {
      const owner = await signUp(harness);
      const aEmail = email();
      const bEmail = email();
      const a = await signUp(harness, { email: aEmail });
      const b = await signUp(harness, { email: bEmail });
      await invite(owner, owner.boardId, aEmail);
      await invite(owner, owner.boardId, bEmail);

      const removeOther = await harness.request(
        `/api/boards/${owner.boardId}/members/${b.userId}`,
        { method: "DELETE", session: a }
      );
      expect(removeOther.status).toBe(403);

      const leave = await harness.request(`/api/boards/${owner.boardId}/members/${a.userId}`, {
        method: "DELETE",
        session: a,
      });
      expect(leave.status).toBe(204);
      expect((await listBoards(a)).map((board) => board.id)).not.toContain(owner.boardId);
    });

    it("does not let the owner leave their own board", async () => {
      const owner = await signUp(harness);
      await createBoard(owner);
      const response = await harness.request(
        `/api/boards/${owner.boardId}/members/${owner.userId}`,
        { method: "DELETE", session: owner }
      );
      expect(response.status).toBe(400);
    });

    it("tells connected clients when membership changes", async () => {
      const owner = await signUp(harness);
      const memberEmail = email();
      await signUp(harness, { email: memberEmail });

      const received: string[] = [];
      const unsubscribe = harness.hub.subscribe({
        id: "watcher",
        boardId: owner.boardId,
        userId: owner.userId,
        name: "Owner",
        color: "#000",
        send: (message) => received.push(message.type),
      });

      await invite(owner, owner.boardId, memberEmail);
      unsubscribe();

      expect(received).toContain("board.changed");
    });
  });
});
