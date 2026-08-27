import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  bulkDeleteTasksSchema,
  bulkUpdateTasksSchema,
  createTaskSchema,
  positionAfterLast,
  updateTaskSchema,
  type Task,
} from "@auralis/shared";
import { activities, boardMembers, tasks } from "../db/schema.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";
import type { TaskRow } from "../db/schema.js";

const router = new Hono<AppContext>();
router.use("*", requireAuth);

/** Rows carry Dates and nullable columns; the wire format is the shared Task. */
function serialize(row: TaskRow): Task {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    assigneeId: row.assigneeId,
    position: row.position,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/**
 * Confirms the caller is a member of the board and returns their role.
 * Every task route runs this first — authorisation is never inferred from
 * the task row alone, because a task id is guessable and a board id is not
 * a permission.
 */
async function assertBoardAccess(
  db: Database,
  boardId: string,
  userId: string,
  write: boolean
): Promise<"owner" | "editor" | "viewer"> {
  const [membership] = await db
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .limit(1);

  if (!membership) throw forbidden();
  if (write && membership.role === "viewer") {
    throw forbidden("You have read-only access to this board");
  }
  return membership.role;
}

/** Loads a task and checks board access in one place. */
async function loadTask(
  db: Database,
  taskId: string,
  userId: string,
  write: boolean
): Promise<TaskRow> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw notFound("That task no longer exists");
  await assertBoardAccess(db, row.boardId, userId, write);
  return row;
}

const listQuerySchema = z.object({
  boardId: z.string().uuid(),
});

router.get("/", zValidator("query", listQuerySchema), async (c) => {
  const db = c.get("db");
  const { boardId } = c.req.valid("query");
  await assertBoardAccess(db, boardId, c.get("user").id, false);

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.boardId, boardId))
    .orderBy(asc(tasks.status), asc(tasks.position));

  return c.json({ tasks: rows.map(serialize) });
});

const createBodySchema = createTaskSchema.extend({ boardId: z.string().uuid() });

router.post("/", zValidator("json", createBodySchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const body = c.req.valid("json");
  await assertBoardAccess(db, body.boardId, user.id, true);

  const status = body.status ?? "todo";

  // Append to the end of the target column unless the client computed its own
  // position for an optimistic insert at a specific slot.
  let position = body.position;
  if (!position) {
    const existing = await db
      .select({ position: tasks.position })
      .from(tasks)
      .where(and(eq(tasks.boardId, body.boardId), eq(tasks.status, status)));
    position = positionAfterLast(existing.map((row) => row.position));
  }

  const id = body.id ?? randomUUID();
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(tasks)
      .values({
        id,
        boardId: body.boardId,
        title: body.title,
        description: body.description ?? "",
        status,
        priority: body.priority ?? "low",
        dueDate: body.dueDate ?? null,
        assigneeId: body.assigneeId ?? null,
        parentId: body.parentId ?? null,
        position,
        completedAt: status === "completed" ? new Date() : null,
      })
      .returning();

    await tx.insert(activities).values({
      taskId: inserted!.id,
      boardId: body.boardId,
      actorId: user.id,
      kind: "task.created",
      payload: { title: inserted!.title },
    });

    return inserted!;
  });

  const task = serialize(row);
  c.get("hub").publish(task.boardId, {
    type: "task.upserted",
    origin: c.get("originId"),
    task: task as unknown as Record<string, unknown>,
  });
  return c.json({ task }, 201);
});

// Registered before the `/:id` routes: Hono matches in registration order,
// so a static segment must be declared ahead of the parameter that would
// otherwise swallow it.
router.patch("/bulk", zValidator("json", bulkUpdateTasksSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const { ids, updates } = c.req.valid("json");

  const rows = await db.select().from(tasks).where(inArray(tasks.id, ids));
  if (rows.length !== ids.length) throw notFound("Some of those tasks no longer exist");

  // A bulk edit must not become a way to reach across boards, so every board
  // represented in the selection is authorised individually.
  for (const boardId of new Set(rows.map((row) => row.boardId))) {
    await assertBoardAccess(db, boardId, user.id, true);
  }
  if (updates.position !== undefined) {
    throw badRequest("Position cannot be set on more than one task at a time");
  }

  const updated = await db.transaction(async (tx) => {
    const result = await tx
      .update(tasks)
      .set({
        ...updates,
        updatedAt: new Date(),
        ...(updates.status === "completed" ? { completedAt: new Date() } : {}),
        ...(updates.status !== undefined && updates.status !== "completed"
          ? { completedAt: null }
          : {}),
      })
      .where(inArray(tasks.id, ids))
      .returning();

    await tx.insert(activities).values(
      result.map((row) => ({
        taskId: row.id,
        boardId: row.boardId,
        actorId: user.id,
        kind: "task.updated" as const,
        payload: { bulk: true, updates },
      }))
    );

    return result;
  });

  const hub = c.get("hub");
  for (const row of updated) {
    hub.publish(row.boardId, {
      type: "task.upserted",
      origin: c.get("originId"),
      task: serialize(row) as unknown as Record<string, unknown>,
    });
  }
  return c.json({ tasks: updated.map(serialize) });
});

router.post("/bulk-delete", zValidator("json", bulkDeleteTasksSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const { ids } = c.req.valid("json");

  const rows = await db.select().from(tasks).where(inArray(tasks.id, ids));
  if (rows.length === 0) return c.json({ deleted: 0 });
  for (const boardId of new Set(rows.map((row) => row.boardId))) {
    await assertBoardAccess(db, boardId, user.id, true);
  }

  await db.transaction(async (tx) => {
    await tx.insert(activities).values(
      rows.map((row) => ({
        taskId: row.id,
        boardId: row.boardId,
        actorId: user.id,
        kind: "task.deleted" as const,
        payload: { title: row.title, bulk: true },
      }))
    );
    await tx.delete(tasks).where(inArray(tasks.id, ids));
  });

  const hub = c.get("hub");
  for (const row of rows) {
    hub.publish(row.boardId, {
      type: "task.deleted",
      origin: c.get("originId"),
      taskId: row.id,
    });
  }
  return c.json({ deleted: rows.length });
});

const idParamSchema = z.object({ id: z.string().uuid() });

router.get("/:id", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const row = await loadTask(db, c.req.valid("param").id, c.get("user").id, false);
  return c.json({ task: serialize(row) });
});

router.patch(
  "/:id",
  zValidator("param", idParamSchema),
  zValidator("json", updateTaskSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");

    const existing = await loadTask(db, id, user.id, true);

    if (Object.keys(updates).length === 0) {
      return c.json({ task: serialize(existing) });
    }

    if (updates.parentId !== undefined && updates.parentId !== null) {
      if (updates.parentId === id) throw badRequest("A task cannot be its own parent");
      await assertNoParentCycle(db, id, updates.parentId);
    }

    const enteringCompleted = updates.status === "completed" && existing.status !== "completed";
    const leavingCompleted =
      updates.status !== undefined &&
      updates.status !== "completed" &&
      existing.status === "completed";

    const row = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tasks)
        .set({
          ...updates,
          updatedAt: new Date(),
          ...(enteringCompleted ? { completedAt: new Date() } : {}),
          ...(leavingCompleted ? { completedAt: null } : {}),
        })
        .where(eq(tasks.id, id))
        .returning();

      const kind = enteringCompleted
        ? "task.completed"
        : leavingCompleted
          ? "task.reopened"
          : updates.status !== undefined && updates.status !== existing.status
            ? "task.moved"
            : "task.updated";

      // Record only the fields that actually changed, with their prior value,
      // so the timeline can render a real before/after.
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, value] of Object.entries(updates)) {
        const before = (existing as Record<string, unknown>)[key];
        if (before !== value) changes[key] = { from: before, to: value };
      }

      await tx.insert(activities).values({
        taskId: id,
        boardId: existing.boardId,
        actorId: user.id,
        kind,
        payload: changes,
      });

      return updated!;
    });

    const task = serialize(row);
    c.get("hub").publish(task.boardId, {
      type: "task.upserted",
      origin: c.get("originId"),
      task: task as unknown as Record<string, unknown>,
    });
    return c.json({ task });
  }
);

router.delete("/:id", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const existing = await loadTask(db, id, user.id, true);

  await db.transaction(async (tx) => {
    // The activity row outlives the task, so the board timeline keeps its
    // history. `taskId` is intentionally not a foreign key for this reason.
    await tx.insert(activities).values({
      taskId: id,
      boardId: existing.boardId,
      actorId: user.id,
      kind: "task.deleted",
      payload: { title: existing.title },
    });
    await tx.delete(tasks).where(eq(tasks.id, id));
  });

  c.get("hub").publish(existing.boardId, {
    type: "task.deleted",
    origin: c.get("originId"),
    taskId: id,
  });
  return c.body(null, 204);
});

router.get("/:id/activity", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  await loadTask(db, id, c.get("user").id, false);

  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.taskId, id))
    .orderBy(desc(activities.createdAt))
    .limit(100);

  return c.json({
    activity: rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      boardId: row.boardId,
      actorId: row.actorId,
      kind: row.kind,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

/**
 * Walks up from the proposed parent to make sure `taskId` is not already an
 * ancestor of it. Without this a subtask could be made the parent of its own
 * parent, and any recursive read of the tree would never terminate.
 */
async function assertNoParentCycle(
  db: Database,
  taskId: string,
  proposedParentId: string
): Promise<void> {
  const result = await db.execute(sql`
    with recursive ancestors as (
      select id, parent_id from tasks where id = ${proposedParentId}
      union all
      select t.id, t.parent_id from tasks t join ancestors a on t.id = a.parent_id
    )
    select 1 as hit from ancestors where id = ${taskId} limit 1
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) ?? [];
  if (rows.length > 0) {
    throw conflict("That would make the task a descendant of itself");
  }
}

export default router;
