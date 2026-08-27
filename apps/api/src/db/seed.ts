import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import {
  initialPositions,
  toISODate,
  type TaskPriority,
  type TaskStatus,
} from "@auralis/shared";
import { activities, boardMembers, boards, tasks, users } from "./schema.js";
import { createDatabase, type Database } from "./client.js";
import { runMigrations } from "./migrate.js";
import { hashPassword } from "../lib/password.js";
import { colorForId } from "../lib/tokens.js";

/**
 * Sample content for the demo board.
 *
 * Offsets are relative to "today" so the board always has a couple of things
 * genuinely overdue, something due today and something upcoming — the states
 * the UI needs to demonstrate. Hardcoded dates would go stale within a week
 * and the overdue styling would never appear.
 */
interface SampleTask {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Days from today; null for no due date. */
  dueIn: number | null;
  /** How long ago the task was created, in days. */
  createdDaysAgo: number;
}

const SAMPLE_TASKS: SampleTask[] = [
  {
    title: "Ship the onboarding tour",
    description: "First-run guidance so a new board is never a dead end.",
    status: "inprogress",
    priority: "high",
    dueIn: 2,
    createdDaysAgo: 4,
  },
  {
    title: "Fix timezone drift on due dates",
    description: "Dates are calendar days, not instants. Store them as text.",
    status: "completed",
    priority: "urgent",
    dueIn: -6,
    createdDaysAgo: 21,
  },
  {
    title: "Audit colour contrast in dark mode",
    description: "Every text/background pair should clear WCAG AA at 4.5:1.",
    status: "todo",
    priority: "medium",
    dueIn: -2,
    createdDaysAgo: 9,
  },
  {
    title: "Write the realtime reconnection test",
    description: "Drop the socket mid-drag and confirm the board reconciles.",
    status: "review",
    priority: "high",
    dueIn: 0,
    createdDaysAgo: 3,
  },
  {
    title: "Reduce the board bundle below 200KB",
    description: "Split the analytics charts out of the main entry.",
    status: "todo",
    priority: "medium",
    dueIn: 9,
    createdDaysAgo: 6,
  },
  {
    title: "Add keyboard shortcuts for status changes",
    description: "1-4 moves the focused card between columns.",
    status: "todo",
    priority: "low",
    dueIn: null,
    createdDaysAgo: 14,
  },
  {
    title: "Rotate refresh tokens on every use",
    description: "Detect replay by revoking the whole token family.",
    status: "completed",
    priority: "urgent",
    dueIn: -11,
    createdDaysAgo: 26,
  },
  {
    title: "Design the empty state illustration",
    description: "It should read as an invitation, not an error.",
    status: "inprogress",
    priority: "low",
    dueIn: 4,
    createdDaysAgo: 7,
  },
  {
    title: "Paginate the activity timeline",
    description: "Long-lived tasks accumulate hundreds of events.",
    status: "todo",
    priority: "low",
    dueIn: 16,
    createdDaysAgo: 2,
  },
  {
    title: "Set up the deploy preview workflow",
    description: "Every pull request gets its own URL.",
    status: "review",
    priority: "medium",
    dueIn: 1,
    createdDaysAgo: 5,
  },
  {
    title: "Handle drag-and-drop on touch devices",
    description: "Long-press to pick up, with a clear lift affordance.",
    status: "todo",
    priority: "high",
    dueIn: -1,
    createdDaysAgo: 11,
  },
  {
    title: "Document the fractional indexing scheme",
    description: "Explain why positions are strings and not integers.",
    status: "completed",
    priority: "low",
    dueIn: -4,
    createdDaysAgo: 18,
  },
];

/** A Date the given number of whole days before `now`. */
function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

function dueDateFor(offset: number | null, now: Date): string | null {
  if (offset === null) return null;
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

export interface SeedOptions {
  sampleTasks: boolean;
  boardName?: string;
  now?: Date;
}

/**
 * Creates a board owned by `userId`, optionally filled with sample tasks.
 *
 * Runs as one transaction so a failure part-way cannot leave a user with a
 * board they are not a member of.
 */
export async function seedDemoBoard(
  db: Database,
  userId: string,
  options: SeedOptions
): Promise<{ id: string; name: string }> {
  const now = options.now ?? new Date();
  const boardId = randomUUID();
  const name = options.boardName ?? "My Board";

  await db.transaction(async (tx) => {
    await tx.insert(boards).values({ id: boardId, name, ownerId: userId });
    await tx.insert(boardMembers).values({ boardId, userId, role: "owner" });

    if (!options.sampleTasks) return;

    // Positions are assigned per column, since ordering is scoped to a column.
    const byStatus = new Map<TaskStatus, SampleTask[]>();
    for (const task of SAMPLE_TASKS) {
      const bucket = byStatus.get(task.status) ?? [];
      bucket.push(task);
      byStatus.set(task.status, bucket);
    }

    /*
     * Timestamps are backdated rather than all stamped "now".
     *
     * A board where every task was created this second puts the whole ageing
     * chart in one bucket, reports a median cycle time of zero, and gives every
     * task an empty history — so the demo shows the features not working. These
     * dates are what a project a few weeks in actually looks like.
     */
    const rows = [...byStatus.values()].flatMap((bucket) => {
      const positions = initialPositions(bucket.length);
      return bucket.map((task, index) => {
        const createdAt = daysBefore(now, task.createdDaysAgo);
        // Completed work finished somewhere between creation and today.
        const completedAt =
          task.status === "completed"
            ? daysBefore(now, Math.floor(task.createdDaysAgo / 3))
            : null;

        return {
          boardId,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: dueDateFor(task.dueIn, now),
          position: positions[index]!,
          createdAt,
          updatedAt: completedAt ?? createdAt,
          completedAt,
        };
      });
    });

    const inserted = await tx.insert(tasks).values(rows).returning();

    // Give each seeded task the creation event it would have had, so the
    // history panel has something to show on a demo board.
    await tx.insert(activities).values(
      inserted.map((row) => ({
        taskId: row.id,
        boardId,
        actorId: userId,
        kind: "task.created" as const,
        payload: { title: row.title },
        createdAt: row.createdAt,
      }))
    );
  });

  return { id: boardId, name };
}

/** `npm run db:seed` — creates a demo account with a populated board. */
async function main(): Promise<void> {
  const handle = createDatabase();
  await runMigrations(handle);

  const email = process.env.SEED_EMAIL ?? "demo@auralis.app";
  const password = process.env.SEED_PASSWORD ?? "demo-password-1234";

  const [existing] = await handle.db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    console.log(`Seed user ${email} already exists; nothing to do.`);
    await handle.close();
    return;
  }

  const id = randomUUID();
  await handle.db.insert(users).values({
    id,
    email,
    name: "Demo",
    passwordHash: await hashPassword(password),
    color: colorForId(id),
  });
  const board = await seedDemoBoard(handle.db, id, { sampleTasks: true, boardName: "Product" });

  console.log(`Seeded ${email} with board "${board.name}" (${SAMPLE_TASKS.length} tasks).`);
  await handle.close();
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
