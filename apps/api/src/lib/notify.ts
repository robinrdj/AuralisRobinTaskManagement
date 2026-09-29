import { and, eq, inArray, ne } from "drizzle-orm";
import type { NotificationKind } from "@auralis/shared";
import { boardMembers, notifications, taskDependencies, tasks } from "../db/schema.js";
import type { Database } from "../db/client.js";
import type { RealtimeHub } from "../realtime/hub.js";

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  boardId: string | null;
  taskId?: string | null;
  actorId?: string | null;
  subject: string;
  detail?: string | null;
  dedupeKey?: string | null;
}

/**
 * Stores notifications and pings each recipient's open connections.
 *
 * Called after the change that caused them has committed, and never allowed
 * to fail it: a notification that does not arrive is a nuisance, but a task
 * edit rejected because a notification could not be written would be a bug.
 * Nobody is ever notified about their own action.
 */
export async function notify(
  db: Database,
  hub: RealtimeHub,
  entries: NewNotification[]
): Promise<void> {
  const wanted = entries.filter((entry) => entry.userId !== entry.actorId);
  if (wanted.length === 0) return;

  try {
    const inserted = await db
      .insert(notifications)
      .values(
        wanted.map((entry) => ({
          userId: entry.userId,
          kind: entry.kind,
          boardId: entry.boardId,
          taskId: entry.taskId ?? null,
          actorId: entry.actorId ?? null,
          subject: entry.subject,
          detail: entry.detail ?? null,
          dedupeKey: entry.dedupeKey ?? null,
        }))
      )
      .onConflictDoNothing()
      .returning({ userId: notifications.userId });

    for (const userId of new Set(inserted.map((row) => row.userId))) {
      hub.publishToUser(userId, { type: "notification.new" });
    }
  } catch (err) {
    console.error("[notify] could not store notifications", err);
  }
}

/**
 * "You were assigned" notices for the people among `assigneeIds` who are on
 * the board. Assigning someone who is not a member notifies nobody: they
 * could not open the task anyway.
 */
export async function assignmentNotices(
  db: Database,
  boardId: string,
  actorId: string,
  assignments: { assigneeId: string; taskId: string; title: string }[]
): Promise<NewNotification[]> {
  if (assignments.length === 0) return [];
  const members = await db
    .select({ userId: boardMembers.userId })
    .from(boardMembers)
    .where(
      and(
        eq(boardMembers.boardId, boardId),
        inArray(
          boardMembers.userId,
          assignments.map((entry) => entry.assigneeId)
        )
      )
    );
  const onBoard = new Set(members.map((member) => member.userId));
  return assignments
    .filter((entry) => onBoard.has(entry.assigneeId))
    .map((entry) => ({
      userId: entry.assigneeId,
      kind: "assigned" as const,
      boardId,
      taskId: entry.taskId,
      actorId,
      subject: entry.title,
    }));
}

/**
 * Tasks that just became workable because `completedIds` finished: open,
 * assigned, and with no unfinished blocker left.
 */
export async function newlyUnblocked(
  db: Database,
  completedIds: string[]
): Promise<{ id: string; title: string; boardId: string; assigneeId: string }[]> {
  if (completedIds.length === 0) return [];

  const candidates = await db
    .selectDistinct({
      id: tasks.id,
      title: tasks.title,
      boardId: tasks.boardId,
      assigneeId: tasks.assigneeId,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.blockedId))
    .where(
      and(inArray(taskDependencies.blockerId, completedIds), ne(tasks.status, "completed"))
    );

  const ready = [];
  for (const candidate of candidates) {
    if (!candidate.assigneeId) continue;
    const [stillBlocked] = await db
      .select({ id: tasks.id })
      .from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.blockerId))
      .where(and(eq(taskDependencies.blockedId, candidate.id), ne(tasks.status, "completed")))
      .limit(1);
    if (!stillBlocked) ready.push({ ...candidate, assigneeId: candidate.assigneeId });
  }
  return ready;
}
