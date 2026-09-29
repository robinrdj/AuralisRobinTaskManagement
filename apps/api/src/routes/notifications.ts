import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Notification } from "@auralis/shared";
import { boardMembers, boards, notifications, tasks, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";
import type { RealtimeHub } from "../realtime/hub.js";

const router = new Hono<AppContext>();
router.use("*", requireAuth);

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Due-date reminders are generated when the list is read, rather than by a
 * scheduler: there is no job to run or fall behind, and the dedupe key means
 * reading the list twice never stores the same reminder twice.
 */
async function remindAboutDueTasks(
  db: Database,
  hub: RealtimeHub,
  userId: string,
  today: string
): Promise<void> {
  const tomorrow = addDays(today, 1);
  const due = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      boardId: tasks.boardId,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .innerJoin(
      boardMembers,
      and(eq(boardMembers.boardId, tasks.boardId), eq(boardMembers.userId, userId))
    )
    .where(
      and(
        eq(tasks.assigneeId, userId),
        ne(tasks.status, "completed"),
        gte(tasks.dueDate, today),
        lte(tasks.dueDate, tomorrow)
      )
    );

  await notify(
    db,
    hub,
    due.map((task) => ({
      userId,
      kind: "due_soon" as const,
      boardId: task.boardId,
      taskId: task.id,
      subject: task.title,
      detail: task.dueDate === today ? "today" : "tomorrow",
      dedupeKey: `due:${task.id}:${task.dueDate}`,
    }))
  );
}

const listQuerySchema = z.object({
  /** The caller's own calendar day, so "due today" means their today. */
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

router.get("/", zValidator("query", listQuerySchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const today = c.req.valid("query").today ?? new Date().toISOString().slice(0, 10);

  await remindAboutDueTasks(db, c.get("hub"), user.id, today);

  const actors = alias(users, "actors");
  const rows = await db
    .select({ notification: notifications, actorName: actors.name, boardName: boards.name })
    .from(notifications)
    .leftJoin(actors, eq(actors.id, notifications.actorId))
    .leftJoin(boards, eq(boards.id, notifications.boardId))
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  const list: Notification[] = rows.map(({ notification, actorName, boardName }) => ({
    id: notification.id,
    kind: notification.kind,
    boardId: notification.boardId,
    boardName,
    taskId: notification.taskId,
    subject: notification.subject,
    actorId: notification.actorId,
    actorName,
    detail: notification.detail,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }));

  return c.json({ notifications: list, unread: unread?.value ?? 0 });
});

/** Marks the given notifications read, or all of them when no ids are sent. */
router.post(
  "/read",
  zValidator("json", z.object({ ids: z.array(z.string().uuid()).max(200).optional() })),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { ids } = c.req.valid("json");
    // An explicit empty list means "none", not "all".
    if (ids && ids.length === 0) return c.body(null, 204);

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, user.id),
          isNull(notifications.readAt),
          ids ? inArray(notifications.id, ids) : undefined
        )
      );
    return c.body(null, 204);
  }
);

export default router;
