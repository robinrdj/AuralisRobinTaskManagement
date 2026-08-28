import { z } from "zod";

/**
 * Domain enums.
 *
 * These are the single source of truth for both the Postgres enum types
 * (see apps/api/src/db/schema.ts) and the client-side UI. Adding a value
 * here is a migration; the type system will point at every site that
 * needs updating.
 */
export const TASK_STATUSES = ["todo", "inprogress", "review", "completed"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);

/**
 * An ISO-8601 instant, always UTC, always serialised as a string.
 *
 * The previous version of this app stored dates as "dd-MM-yyyy" strings,
 * which sort lexicographically rather than chronologically — so date
 * sorting, range filters and overdue detection were all subtly wrong.
 * Every timestamp that crosses the wire is now an ISO instant, and
 * formatting happens exclusively at render time.
 */
export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe("ISO-8601 timestamp");

/** A calendar day with no time component, e.g. "2026-08-26". */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO calendar date (YYYY-MM-DD)")
  .describe("ISO-8601 calendar date");

export const taskSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(""),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  /** Null means "no due date", never an empty string. */
  dueDate: isoDateSchema.nullable(),
  assigneeId: z.string().uuid().nullable(),
  /** Fractional index for stable ordering within a column under concurrent drags. */
  position: z.string(),
  parentId: z.string().uuid().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
});

export type Task = z.infer<typeof taskSchema>;

/** Fields a client may supply when creating a task. */
export const createTaskSchema = taskSchema
  .pick({ title: true, description: true, status: true, priority: true, dueDate: true })
  .partial({ description: true, status: true, priority: true, dueDate: true })
  .extend({
    assigneeId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    position: z.string().optional(),
    /** Client-generated so optimistic inserts keep their identity after the server responds. */
    id: z.string().uuid().optional(),
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Fields a client may change. `id` travels in the URL, not the body. */
export const updateTaskSchema = taskSchema
  .pick({
    title: true,
    description: true,
    status: true,
    priority: true,
    dueDate: true,
    assigneeId: true,
    position: true,
    parentId: true,
  })
  .partial();

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const bulkUpdateTasksSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  updates: updateTaskSchema,
});

export const bulkDeleteTasksSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * A task blocks another task. Cycles are rejected by the API, so the
 * dependency graph is always a DAG and can be topologically ordered.
 */
export const taskDependencySchema = z.object({
  blockerId: z.string().uuid(),
  blockedId: z.string().uuid(),
});

export type TaskDependency = z.infer<typeof taskDependencySchema>;

/**
 * Many tasks in one request.
 *
 * Import writes a whole file at once; doing that as N create calls is N
 * round trips and N activity rows fanned out one at a time.
 */
export const bulkCreateTasksSchema = z.object({
  boardId: z.string().uuid(),
  tasks: z.array(createTaskSchema).min(1).max(1000),
});

export type BulkCreateTasksInput = z.infer<typeof bulkCreateTasksSchema>;
