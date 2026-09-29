import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { commentBodySchema, extractMentionIds, type Comment } from "@auralis/shared";
import { activities, boardMembers, comments, users } from "../db/schema.js";
import { forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertBoardAccess, loadTask } from "./tasks.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";

/**
 * Comments on a task, mounted under /api/tasks.
 *
 * Auth is applied per route rather than with `use("*")`: this router shares
 * its prefix with the task router, and a wildcard here would run the session
 * lookup a second time on every task request.
 */
const router = new Hono<AppContext>();

const taskParamSchema = z.object({ id: z.string().uuid() });
const commentParamSchema = taskParamSchema.extend({ commentId: z.string().uuid() });

/** Reads comments with their author's current name and colour. */
async function listComments(db: Database, where: ReturnType<typeof eq>): Promise<Comment[]> {
  const rows = await db
    .select({ comment: comments, authorName: users.name, authorColor: users.color })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(where)
    .orderBy(asc(comments.createdAt));

  return rows.map(({ comment, authorName, authorColor }) => ({
    id: comment.id,
    taskId: comment.taskId,
    boardId: comment.boardId,
    authorId: comment.authorId,
    authorName,
    authorColor,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
  }));
}

/**
 * The people a comment mentions who can actually see it.
 *
 * A mention of someone off the board is left in the text but reaches nobody —
 * otherwise a mention would be a way to message arbitrary accounts.
 */
export async function mentionedMembers(
  db: Database,
  boardId: string,
  body: string,
  authorId: string
): Promise<string[]> {
  const ids = extractMentionIds(body).filter((id) => id !== authorId);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ userId: boardMembers.userId })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), inArray(boardMembers.userId, ids)));
  return rows.map((row) => row.userId);
}

router.get("/:id/comments", requireAuth, zValidator("param", taskParamSchema), async (c) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  await loadTask(db, id, c.get("user").id, false);
  return c.json({ comments: await listComments(db, eq(comments.taskId, id)) });
});

router.post(
  "/:id/comments",
  requireAuth,
  zValidator("param", taskParamSchema),
  zValidator("json", commentBodySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const task = await loadTask(db, id, user.id, true);

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(comments)
        .values({ taskId: id, boardId: task.boardId, authorId: user.id, body })
        .returning();

      // The history shows that a conversation happened; the text lives in the thread.
      await tx.insert(activities).values({
        taskId: id,
        boardId: task.boardId,
        actorId: user.id,
        kind: "comment.added",
        payload: { commentId: row!.id },
      });
      return row!;
    });

    const mentioned = await mentionedMembers(db, task.boardId, body, user.id);

    c.get("hub").publish(task.boardId, {
      type: "comment.changed",
      origin: c.get("originId"),
      taskId: id,
    });

    const [comment] = await listComments(db, eq(comments.id, created.id));
    return c.json({ comment, mentioned }, 201);
  }
);

/** Loads a comment on a task the caller can see, checking the two belong together. */
async function loadComment(db: Database, taskId: string, commentId: string) {
  const [row] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.taskId, taskId)))
    .limit(1);
  if (!row) throw notFound("That comment no longer exists");
  return row;
}

router.patch(
  "/:id/comments/:commentId",
  requireAuth,
  zValidator("param", commentParamSchema),
  zValidator("json", commentBodySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id, commentId } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const task = await loadTask(db, id, user.id, true);
    const existing = await loadComment(db, id, commentId);

    // Editing someone else's words is never allowed, owner or not.
    if (existing.authorId !== user.id) throw forbidden("You can only edit your own comments");

    await db
      .update(comments)
      .set({ body, editedAt: new Date() })
      .where(eq(comments.id, commentId));

    // Only people newly mentioned by the edit are worth telling about it.
    const before = new Set(extractMentionIds(existing.body));
    const mentioned = (await mentionedMembers(db, task.boardId, body, user.id)).filter(
      (userId) => !before.has(userId)
    );

    c.get("hub").publish(task.boardId, {
      type: "comment.changed",
      origin: c.get("originId"),
      taskId: id,
    });

    const [comment] = await listComments(db, eq(comments.id, commentId));
    return c.json({ comment, mentioned });
  }
);

/** The author can delete their comment, and so can the board owner, for moderation. */
router.delete(
  "/:id/comments/:commentId",
  requireAuth,
  zValidator("param", commentParamSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id, commentId } = c.req.valid("param");
    const task = await loadTask(db, id, user.id, false);
    const existing = await loadComment(db, id, commentId);

    if (existing.authorId !== user.id) {
      const role = await assertBoardAccess(db, task.boardId, user.id, false);
      if (role !== "owner") throw forbidden("You can only delete your own comments");
    }

    await db.delete(comments).where(eq(comments.id, commentId));

    c.get("hub").publish(task.boardId, {
      type: "comment.changed",
      origin: c.get("originId"),
      taskId: id,
    });
    return c.body(null, 204);
  }
);

export default router;
