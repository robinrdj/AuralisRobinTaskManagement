import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { manualTimeSchema, type RunningTimer, type TimeEntry } from "@auralis/shared";
import { tasks, timeEntries, users } from "../db/schema.js";
import { forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertBoardAccess, loadTask } from "./tasks.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";

/** Time tracking, mounted at /api with auth applied per route. */
const router = new Hono<AppContext>();

const taskParamSchema = z.object({ id: z.string().uuid() });
const entryParamSchema = taskParamSchema.extend({ entryId: z.string().uuid() });

type EntryRow = typeof timeEntries.$inferSelect;

function toEntry(row: EntryRow, userName: string | null): TimeEntry {
  return {
    id: row.id,
    taskId: row.taskId,
    boardId: row.boardId,
    userId: row.userId,
    userName,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    note: row.note,
  };
}

/** Seconds covered by entries, counting a running timer up to now. */
const secondsSql = sql<number>`coalesce(sum(extract(epoch from (coalesce(${timeEntries.endedAt}, now()) - ${timeEntries.startedAt}))), 0)::float8`;

/** Stops the caller's running timer, wherever it is. Returns the stopped entry. */
async function stopRunning(db: Database, userId: string): Promise<EntryRow | null> {
  const [stopped] = await db
    .update(timeEntries)
    .set({ endedAt: new Date() })
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endedAt)))
    .returning();
  return stopped ?? null;
}

/**
 * Tells the board the task's totals moved, and tells the person their timer
 * changed — on every tab they have open, whichever board it shows.
 */
function announce(c: Context<AppContext>, entries: (EntryRow | null)[]) {
  const hub = c.get("hub");
  for (const entry of entries) {
    if (!entry) continue;
    hub.publish(entry.boardId, {
      type: "time.changed",
      origin: c.get("originId"),
      taskId: entry.taskId,
    });
  }
  hub.publishToUser(c.get("user").id, { type: "timer.changed" });
}

router.get("/tasks/:id/time", requireAuth, zValidator("param", taskParamSchema), async (c) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  await loadTask(db, id, c.get("user").id, false);

  const rows = await db
    .select({ entry: timeEntries, userName: users.name })
    .from(timeEntries)
    .leftJoin(users, eq(users.id, timeEntries.userId))
    .where(eq(timeEntries.taskId, id))
    .orderBy(desc(timeEntries.startedAt));

  return c.json({ entries: rows.map((row) => toEntry(row.entry, row.userName)) });
});

/** Starts a timer on the task, stopping any other timer the caller has running. */
router.post(
  "/tasks/:id/time/start",
  requireAuth,
  zValidator("param", taskParamSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const task = await loadTask(db, id, user.id, true);

    const { stopped, started } = await db.transaction(async (tx) => {
      const [previous] = await tx
        .update(timeEntries)
        .set({ endedAt: new Date() })
        .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)))
        .returning();
      const [entry] = await tx
        .insert(timeEntries)
        .values({ taskId: id, boardId: task.boardId, userId: user.id, startedAt: new Date() })
        .returning();
      return { stopped: previous ?? null, started: entry! };
    });

    announce(c, [stopped, started]);
    return c.json({ entry: toEntry(started, user.name) }, 201);
  }
);

router.post("/time/stop", requireAuth, async (c) => {
  const stopped = await stopRunning(c.get("db"), c.get("user").id);
  announce(c, [stopped]);
  return c.json({ entry: stopped ? toEntry(stopped, c.get("user").name) : null });
});

/** The caller's running timer, with the task's title for the header. */
router.get("/time/running", requireAuth, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const [row] = await db
    .select({ entry: timeEntries, taskTitle: tasks.title })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)))
    .limit(1);

  const running: RunningTimer | null = row
    ? { ...toEntry(row.entry, user.name), taskTitle: row.taskTitle }
    : null;
  return c.json({ entry: running });
});

/** Adds time after the fact: "I spent 45 minutes on this yesterday". */
router.post(
  "/tasks/:id/time",
  requireAuth,
  zValidator("param", taskParamSchema),
  zValidator("json", manualTimeSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const { minutes, date, note } = c.req.valid("json");
    const task = await loadTask(db, id, user.id, true);

    // A past day's entry ends at midday UTC on that day, which keeps it on
    // that calendar day for everyone within twelve hours of UTC.
    const endedAt = date ? new Date(`${date}T12:00:00Z`) : new Date();
    const startedAt = new Date(endedAt.getTime() - minutes * 60_000);

    const [row] = await db
      .insert(timeEntries)
      .values({
        taskId: id,
        boardId: task.boardId,
        userId: user.id,
        startedAt,
        endedAt,
        note: note || null,
      })
      .returning();

    announce(c, [row!]);
    return c.json({ entry: toEntry(row!, user.name) }, 201);
  }
);

/** People remove their own entries; the board owner can remove anyone's. */
router.delete(
  "/tasks/:id/time/:entryId",
  requireAuth,
  zValidator("param", entryParamSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id, entryId } = c.req.valid("param");
    const task = await loadTask(db, id, user.id, true);

    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, entryId), eq(timeEntries.taskId, id)))
      .limit(1);
    if (!entry) throw notFound("That time entry no longer exists");
    if (entry.userId !== user.id) {
      const role = await assertBoardAccess(db, task.boardId, user.id, true);
      if (role !== "owner") throw forbidden("You can only remove your own time");
    }

    await db.delete(timeEntries).where(eq(timeEntries.id, entryId));
    announce(c, [entry]);
    return c.body(null, 204);
  }
);

const reportQuerySchema = z.object({
  /** Start of the "recent" window for the per-person totals; seven days ago by default. */
  since: z.string().datetime({ offset: true }).optional(),
});

/** Totals for the analytics page: per task overall, and per person recently. */
router.get(
  "/boards/:id/time",
  requireAuth,
  zValidator("param", taskParamSchema),
  zValidator("query", reportQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    await assertBoardAccess(db, id, c.get("user").id, false);
    const since = new Date(c.req.valid("query").since ?? Date.now() - 7 * 86_400_000);

    const [byTask, byPerson] = await Promise.all([
      db
        .select({ taskId: timeEntries.taskId, seconds: secondsSql })
        .from(timeEntries)
        .where(eq(timeEntries.boardId, id))
        .groupBy(timeEntries.taskId),
      db
        .select({ userId: timeEntries.userId, name: users.name, seconds: secondsSql })
        .from(timeEntries)
        .leftJoin(users, eq(users.id, timeEntries.userId))
        .where(and(eq(timeEntries.boardId, id), gte(timeEntries.startedAt, since)))
        .groupBy(timeEntries.userId, users.name)
        .orderBy(asc(users.name)),
    ]);

    return c.json({
      byTask: byTask.map((row) => ({
        taskId: row.taskId,
        seconds: Math.round(Number(row.seconds)),
      })),
      byPerson: byPerson.map((row) => ({
        userId: row.userId,
        name: row.name ?? "Former member",
        seconds: Math.round(Number(row.seconds)),
      })),
    });
  }
);

export default router;
