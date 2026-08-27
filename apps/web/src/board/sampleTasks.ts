import type { CreateTaskInput, TaskPriority, TaskStatus } from "@auralis/shared";
import { initialPositions, toISODate } from "@auralis/shared";

/**
 * The sample project Auri offers to drop onto an empty board.
 *
 * Due dates are relative to today so the board always shows genuinely overdue
 * work, something due today and something upcoming — the states the card
 * styling and the analytics exist to show. Fixed dates would go stale in a
 * week and the overdue treatment would never appear in a demo.
 */
interface Sample {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueIn: number | null;
}

const SAMPLES: Sample[] = [
  {
    title: "Draft the Q3 launch plan",
    description: "Scope, milestones and who owns each one.",
    status: "inprogress",
    priority: "high",
    dueIn: 2,
  },
  {
    title: "Fix the timezone bug on due dates",
    description: "Dates are calendar days, not instants.",
    status: "completed",
    priority: "urgent",
    dueIn: -6,
  },
  {
    title: "Audit colour contrast in dark mode",
    description: "Every text and background pair should clear WCAG AA.",
    status: "todo",
    priority: "medium",
    dueIn: -2,
  },
  {
    title: "Review the onboarding copy",
    description: "Shorter. Every line should earn its place.",
    status: "review",
    priority: "high",
    dueIn: 0,
  },
  {
    title: "Cut the bundle below 200KB",
    description: "Split the charts out of the main entry point.",
    status: "todo",
    priority: "medium",
    dueIn: 9,
  },
  {
    title: "Add keyboard shortcuts",
    description: "Number keys move the focused card between columns.",
    status: "todo",
    priority: "low",
    dueIn: null,
  },
  {
    title: "Rotate session tokens on every use",
    description: "Detect replay by revoking the whole family.",
    status: "completed",
    priority: "urgent",
    dueIn: -11,
  },
  {
    title: "Design the empty state",
    description: "It should read as an invitation, not an error.",
    status: "inprogress",
    priority: "low",
    dueIn: 4,
  },
  {
    title: "Paginate the activity timeline",
    description: "Long-lived tasks collect hundreds of events.",
    status: "todo",
    priority: "low",
    dueIn: 16,
  },
  {
    title: "Set up deploy previews",
    description: "Every pull request gets its own URL.",
    status: "review",
    priority: "medium",
    dueIn: 1,
  },
  {
    title: "Make drag work on touch devices",
    description: "Long-press to lift, with a clear affordance.",
    status: "todo",
    priority: "high",
    dueIn: -1,
  },
  {
    title: "Write up the ordering scheme",
    description: "Why positions are strings rather than integers.",
    status: "completed",
    priority: "low",
    dueIn: -4,
  },
];

function dueDate(offset: number | null): string | null {
  if (offset === null) return null;
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

/**
 * Builds the sample task list, dated against today.
 *
 * Positions are assigned here rather than left to the server. The seeding
 * request goes out as one parallel batch, and each server-side insert would
 * otherwise compute "after the last card" against the same starting state —
 * handing every task in a column an identical key.
 */
export function buildSampleTasks(): CreateTaskInput[] {
  const byStatus = new Map<TaskStatus, Sample[]>();
  for (const sample of SAMPLES) {
    const bucket = byStatus.get(sample.status) ?? [];
    bucket.push(sample);
    byStatus.set(sample.status, bucket);
  }

  return [...byStatus.values()].flatMap((bucket) => {
    const positions = initialPositions(bucket.length);
    return bucket.map((sample, index) => ({
      title: sample.title,
      description: sample.description,
      status: sample.status,
      priority: sample.priority,
      dueDate: dueDate(sample.dueIn),
      position: positions[index]!,
    }));
  });
}

/** How many tasks the sample board contains, for the confirmation message. */
export const SAMPLE_TASK_COUNT = SAMPLES.length;
