import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ACTIVITY_KINDS,
  TASK_PRIORITIES,
  TASK_RECURRENCES,
  TASK_STATUSES,
} from "@auralis/shared";

/**
 * Postgres enums are generated from the shared constants, so the database,
 * the API and the UI cannot drift apart — adding a status is one edit plus
 * a migration.
 */
export const taskStatus = pgEnum("task_status", TASK_STATUSES);
export const taskPriority = pgEnum("task_priority", TASK_PRIORITIES);
export const activityKind = pgEnum("activity_kind", ACTIVITY_KINDS);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** scrypt-derived; format is "scrypt$N$r$p$salt$hash". Never leaves the server. */
    passwordHash: text("password_hash").notNull(),
    color: text("color").notNull(),
    isGuest: boolean("is_guest").notNull().default(false),
    /** Guest accounts are reaped by a scheduled job once this passes. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)]
);

/**
 * Refresh tokens are stored hashed and rotated on every use. A replayed
 * token is treated as theft: the whole family is revoked, which logs the
 * attacker and the real user out together.
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
    index("refresh_tokens_user_idx").on(table.userId),
  ]
);

export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardMembers = pgTable(
  "board_members",
  {
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "editor", "viewer"] })
      .notNull()
      .default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.boardId, table.userId] })]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatus("status").notNull().default("todo"),
    priority: taskPriority("priority").notNull().default("low"),
    /**
     * A calendar day, not an instant. `date` avoids the timezone shifts that
     * make a timestamp-backed due date land on the wrong day for half the world.
     */
    dueDate: text("due_date"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    /** Fractional index; see packages/shared/src/ordering.ts. */
    position: text("position").notNull(),
    /** Self-referential: deleting a parent removes its subtasks with it. */
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    /** A TaskRecurrence from the shared package, or null for a one-off task. */
    recurrence: text("recurrence", { enum: TASK_RECURRENCES }),
    /**
     * The occurrence this one was spawned from. Completing a task checks for
     * an existing successor here, so reopening and re-completing it does not
     * put a second copy on the board.
     */
    recurrenceSourceId: uuid("recurrence_source_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    // The board view always reads one board's tasks ordered within a column,
    // so this composite index serves the hot path without a sort.
    index("tasks_board_status_position_idx").on(table.boardId, table.status, table.position),
    index("tasks_board_due_idx").on(table.boardId, table.dueDate),
    index("tasks_parent_idx").on(table.parentId),
  ]
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    index("task_dependencies_blocked_idx").on(table.blockedId),
  ]
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: activityKind("kind").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activities_task_idx").on(table.taskId, table.createdAt),
    index("activities_board_idx").on(table.boardId, table.createdAt),
  ]
);

/** A board's own vocabulary of tags. Names are unique per board, ignoring case. */
export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("labels_board_name_unique").on(table.boardId, sql`lower(${table.name})`),
  ]
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.labelId] }),
    index("task_labels_label_idx").on(table.labelId),
  ]
);

/**
 * A named set of filters and a sort order. Personal to its owner unless
 * `shared`, in which case everyone on the board can apply it.
 */
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** A ViewFilters object from the shared package, validated on the way in. */
    filters: jsonb("filters").notNull(),
    sortBy: text("sort_by").notNull().default("position"),
    sortDirection: text("sort_direction").notNull().default("asc"),
    shared: boolean("shared").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("saved_views_board_idx").on(table.boardId, table.ownerId)]
);

/**
 * Discussion on a task. Deleted with the task; an author who deletes their
 * account leaves their comments behind, unattributed.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Mentions are stored inline as `@[Name](userId)`; see packages/shared/src/comment.ts. */
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (table) => [index("comments_task_idx").on(table.taskId, table.createdAt)]
);

export const usersRelations = relations(users, ({ many }) => ({
  boards: many(boards),
  memberships: many(boardMembers),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  owner: one(users, { fields: [boards.ownerId], references: [users.id] }),
  members: many(boardMembers),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  board: one(boards, { fields: [tasks.boardId], references: [boards.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  activities: many(activities),
}));

export type UserRow = typeof users.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type BoardRow = typeof boards.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
