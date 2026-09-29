import { and, eq } from "drizzle-orm";
import { nextOccurrence, positionAfterLast } from "@auralis/shared";
import { activities, taskLabels, tasks, type TaskRow } from "../db/schema.js";
import type { Database } from "../db/client.js";

/** A transaction handle, which exposes the same query API as the database. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Today as a calendar day in UTC.
 *
 * The server has no idea of the user's timezone. Counting "on or after today"
 * rather than "after today" in `nextOccurrence` absorbs the difference: at
 * worst someone west of UTC finishing late in their evening sees the next one
 * due today instead of tomorrow, never a skipped day.
 */
export function todayUTC(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Puts the next occurrence of a just-completed recurring task on the board.
 *
 * The copy keeps the title, description, priority, assignee and labels,
 * starts in "To do" at the bottom of the column, and records which task it
 * came from. That link is also the guard: if a successor already exists —
 * the task was completed, reopened and completed again — nothing is added.
 */
export async function spawnNextOccurrence(
  tx: Transaction,
  completed: TaskRow,
  actorId: string,
  now = new Date()
): Promise<{ task: TaskRow; copiedLabels: boolean } | null> {
  if (!completed.recurrence) return null;

  const [existing] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.recurrenceSourceId, completed.id))
    .limit(1);
  if (existing) return null;

  const column = await tx
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.boardId, completed.boardId), eq(tasks.status, "todo")));

  const [spawned] = await tx
    .insert(tasks)
    .values({
      boardId: completed.boardId,
      title: completed.title,
      description: completed.description,
      status: "todo",
      priority: completed.priority,
      dueDate: nextOccurrence(completed.dueDate, completed.recurrence, todayUTC(now)),
      assigneeId: completed.assigneeId,
      parentId: completed.parentId,
      position: positionAfterLast(column.map((row) => row.position)),
      recurrence: completed.recurrence,
      recurrenceSourceId: completed.id,
    })
    .returning();

  const labels = await tx
    .select({ labelId: taskLabels.labelId })
    .from(taskLabels)
    .where(eq(taskLabels.taskId, completed.id));
  if (labels.length > 0) {
    await tx
      .insert(taskLabels)
      .values(labels.map(({ labelId }) => ({ taskId: spawned!.id, labelId })));
  }

  await tx.insert(activities).values({
    taskId: spawned!.id,
    boardId: completed.boardId,
    actorId,
    kind: "task.created",
    payload: { title: spawned!.title, recurring: true, previousId: completed.id },
  });

  return { task: spawned!, copiedLabels: labels.length > 0 };
}
