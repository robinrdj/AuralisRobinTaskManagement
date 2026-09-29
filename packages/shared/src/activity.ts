import { z } from "zod";
import { isoDateTimeSchema } from "./task.js";

/**
 * Task activity is an append-only event log. The task row holds current
 * state; this log holds how it got there, and is what the task timeline
 * and the realtime channel are both built from.
 */
export const ACTIVITY_KINDS = [
  "task.created",
  "task.updated",
  "task.moved",
  "task.completed",
  "task.reopened",
  "task.deleted",
  "task.assigned",
  "comment.added",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const activitySchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  boardId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  kind: z.enum(ACTIVITY_KINDS),
  /** Field-level before/after for `task.updated`, free-form for other kinds. */
  payload: z.record(z.unknown()).default({}),
  createdAt: isoDateTimeSchema,
});

export type Activity = z.infer<typeof activitySchema>;

/**
 * Messages pushed over the board's realtime channel. `origin` carries the
 * originating client's id so a client can ignore the echo of its own
 * optimistic write instead of applying it twice.
 */
export const realtimeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task.upserted"),
    origin: z.string().nullable(),
    task: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("task.deleted"),
    origin: z.string().nullable(),
    taskId: z.string().uuid(),
  }),
  /** A task's comments changed; clients viewing that task refetch them. */
  z.object({
    type: z.literal("comment.changed"),
    origin: z.string().nullable(),
    taskId: z.string().uuid(),
  }),
  /** A board's labels, or which tasks carry them, changed. */
  z.object({
    type: z.literal("labels.changed"),
    origin: z.string().nullable(),
    boardId: z.string().uuid(),
  }),
  /** The board's name or membership changed; clients refetch rather than patch. */
  z.object({
    type: z.literal("board.changed"),
    boardId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("presence"),
    members: z.array(
      z.object({
        userId: z.string().uuid(),
        name: z.string(),
        color: z.string(),
      })
    ),
  }),
]);

export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
