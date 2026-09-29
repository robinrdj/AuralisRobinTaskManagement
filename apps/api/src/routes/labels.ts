import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createLabelSchema,
  setTaskLabelsSchema,
  updateLabelSchema,
  type Label,
} from "@auralis/shared";
import { activities, labels, taskLabels } from "../db/schema.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertBoardAccess, loadTask } from "./tasks.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";

/**
 * Labels, mounted at /api. Auth is per route: a wildcard here would cover
 * every /api path, the public ones included.
 */
const router = new Hono<AppContext>();

const boardParamSchema = z.object({ id: z.string().uuid() });
const labelParamSchema = boardParamSchema.extend({ labelId: z.string().uuid() });

function toLabel(row: typeof labels.$inferSelect): Label {
  return { id: row.id, boardId: row.boardId, name: row.name, color: row.color };
}

/** Refuses a name already used on the board, ignoring case. */
async function assertNameFree(db: Database, boardId: string, name: string, exceptId?: string) {
  const [clash] = await db
    .select({ id: labels.id })
    .from(labels)
    .where(
      and(
        eq(labels.boardId, boardId),
        sql`lower(${labels.name}) = lower(${name})`,
        exceptId ? ne(labels.id, exceptId) : undefined
      )
    )
    .limit(1);
  if (clash) throw conflict("This board already has a label with that name");
}

function announce(c: Context<AppContext>, boardId: string) {
  c.get("hub").publish(boardId, {
    type: "labels.changed",
    origin: c.get("originId"),
    boardId,
  });
}

/** Every label on the board, and which tasks carry which, in one request. */
router.get(
  "/boards/:id/labels",
  requireAuth,
  zValidator("param", boardParamSchema),
  async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    await assertBoardAccess(db, id, c.get("user").id, false);

    const [labelRows, assignments] = await Promise.all([
      db.select().from(labels).where(eq(labels.boardId, id)).orderBy(labels.name),
      db
        .select({ taskId: taskLabels.taskId, labelId: taskLabels.labelId })
        .from(taskLabels)
        .innerJoin(labels, eq(labels.id, taskLabels.labelId))
        .where(eq(labels.boardId, id)),
    ]);

    return c.json({ labels: labelRows.map(toLabel), assignments });
  }
);

router.post(
  "/boards/:id/labels",
  requireAuth,
  zValidator("param", boardParamSchema),
  zValidator("json", createLabelSchema),
  async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const { name, color } = c.req.valid("json");
    await assertBoardAccess(db, id, c.get("user").id, true);
    await assertNameFree(db, id, name);

    const [row] = await db.insert(labels).values({ boardId: id, name, color }).returning();
    announce(c, id);
    return c.json({ label: toLabel(row!) }, 201);
  }
);

router.patch(
  "/boards/:id/labels/:labelId",
  requireAuth,
  zValidator("param", labelParamSchema),
  zValidator("json", updateLabelSchema),
  async (c) => {
    const db = c.get("db");
    const { id, labelId } = c.req.valid("param");
    const updates = c.req.valid("json");
    await assertBoardAccess(db, id, c.get("user").id, true);
    if (updates.name) await assertNameFree(db, id, updates.name, labelId);

    const [row] = await db
      .update(labels)
      .set(updates)
      .where(and(eq(labels.id, labelId), eq(labels.boardId, id)))
      .returning();
    if (!row) throw notFound("That label no longer exists");

    announce(c, id);
    return c.json({ label: toLabel(row) });
  }
);

/** Deleting a label takes it off every task that had it. */
router.delete(
  "/boards/:id/labels/:labelId",
  requireAuth,
  zValidator("param", labelParamSchema),
  async (c) => {
    const db = c.get("db");
    const { id, labelId } = c.req.valid("param");
    await assertBoardAccess(db, id, c.get("user").id, true);

    const deleted = await db
      .delete(labels)
      .where(and(eq(labels.id, labelId), eq(labels.boardId, id)))
      .returning({ id: labels.id });
    if (deleted.length === 0) throw notFound("That label no longer exists");

    announce(c, id);
    return c.body(null, 204);
  }
);

/**
 * Replaces the set of labels on a task.
 *
 * A whole set rather than add/remove calls: the client holds the full picture,
 * and replaying the same request is harmless.
 */
router.put(
  "/tasks/:id/labels",
  requireAuth,
  zValidator("param", boardParamSchema),
  zValidator("json", setTaskLabelsSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const labelIds = [...new Set(c.req.valid("json").labelIds)];
    const task = await loadTask(db, id, user.id, true);

    // Every label must belong to the task's own board; ids from elsewhere
    // would otherwise let one board's names leak onto another.
    const wanted =
      labelIds.length === 0
        ? []
        : await db
            .select()
            .from(labels)
            .where(and(inArray(labels.id, labelIds), eq(labels.boardId, task.boardId)));
    if (wanted.length !== labelIds.length) {
      throw badRequest("Some of those labels are not on this board");
    }

    const before = await db
      .select({ name: labels.name })
      .from(taskLabels)
      .innerJoin(labels, eq(labels.id, taskLabels.labelId))
      .where(eq(taskLabels.taskId, id));

    await db.transaction(async (tx) => {
      await tx.delete(taskLabels).where(eq(taskLabels.taskId, id));
      if (labelIds.length > 0) {
        await tx
          .insert(taskLabels)
          .values(labelIds.map((labelId) => ({ taskId: id, labelId })));
      }

      const from = before.map((row) => row.name).sort();
      const to = wanted.map((row) => row.name).sort();
      if (from.join("\n") !== to.join("\n")) {
        await tx.insert(activities).values({
          taskId: id,
          boardId: task.boardId,
          actorId: user.id,
          kind: "task.updated",
          payload: { labels: { from, to } },
        });
      }
    });

    announce(c, task.boardId);
    return c.json({ labelIds });
  }
);

export default router;
