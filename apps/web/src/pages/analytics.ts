import {
  isOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  toISODate,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@auralis/shared";
import { STATUS_LABELS } from "@/components/ui/labels";

/**
 * Analytics is derived, not stored.
 *
 * Every figure on the dashboard is computed from the same task list the board
 * renders, so the two can never disagree. Pure functions, so each series can be
 * asserted directly in a test rather than by reading pixels off a chart.
 */

export interface StatusDatum {
  status: TaskStatus;
  label: string;
  count: number;
}

export function statusBreakdown(tasks: Task[]): StatusDatum[] {
  const counts = new Map<TaskStatus, number>(TASK_STATUSES.map((status) => [status, 0]));
  for (const task of tasks) counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  return TASK_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: counts.get(status) ?? 0,
  }));
}

export interface PriorityDatum {
  priority: TaskPriority;
  label: string;
  open: number;
  completed: number;
}

export function priorityBreakdown(tasks: Task[]): PriorityDatum[] {
  return TASK_PRIORITIES.map((priority) => {
    const matching = tasks.filter((task) => task.priority === priority);
    return {
      priority,
      label: priority.charAt(0).toUpperCase() + priority.slice(1),
      completed: matching.filter((task) => task.status === "completed").length,
      open: matching.filter((task) => task.status !== "completed").length,
    };
  });
}

export interface ThroughputDatum {
  date: string;
  label: string;
  created: number;
  completed: number;
}

/**
 * Tasks created and completed per day over a trailing window.
 *
 * Days with no activity are included as zeroes rather than skipped — omitting
 * them would compress the x-axis and make a quiet week look like a busy one.
 */
export function throughput(tasks: Task[], days = 14, now = new Date()): ThroughputDatum[] {
  const buckets = new Map<string, ThroughputDatum>();

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const iso = toISODate(date);
    buckets.set(iso, {
      date: iso,
      label: date.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      created: 0,
      completed: 0,
    });
  }

  for (const task of tasks) {
    const created = buckets.get(task.createdAt.slice(0, 10));
    if (created) created.created++;
    if (task.completedAt) {
      const completed = buckets.get(task.completedAt.slice(0, 10));
      if (completed) completed.completed++;
    }
  }

  return [...buckets.values()];
}

export interface AgeingDatum {
  bucket: string;
  count: number;
}

/** How long the open work has been sitting there. */
export function ageing(tasks: Task[], now = new Date()): AgeingDatum[] {
  const buckets: AgeingDatum[] = [
    { bucket: "Today", count: 0 },
    { bucket: "1–3 days", count: 0 },
    { bucket: "4–7 days", count: 0 },
    { bucket: "1–2 weeks", count: 0 },
    { bucket: "Over 2 weeks", count: 0 },
  ];

  for (const task of tasks) {
    if (task.status === "completed") continue;
    const ageDays = Math.floor(
      (now.getTime() - new Date(task.createdAt).getTime()) / 86_400_000
    );
    if (ageDays <= 0) buckets[0]!.count++;
    else if (ageDays <= 3) buckets[1]!.count++;
    else if (ageDays <= 7) buckets[2]!.count++;
    else if (ageDays <= 14) buckets[3]!.count++;
    else buckets[4]!.count++;
  }

  return buckets;
}

export interface Headline {
  total: number;
  completed: number;
  completionRate: number;
  overdue: number;
  /** Median days from creation to completion, or null with nothing completed. */
  medianCycleDays: number | null;
}

export function headline(tasks: Task[], now = new Date()): Headline {
  const completed = tasks.filter((task) => task.status === "completed" && task.completedAt);

  const cycleDays = completed
    .map(
      (task) =>
        (new Date(task.completedAt!).getTime() - new Date(task.createdAt).getTime()) /
        86_400_000
    )
    .sort((a, b) => a - b);

  return {
    total: tasks.length,
    completed: completed.length,
    completionRate:
      tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100),
    overdue: tasks.filter((task) => isOverdue(task, now)).length,
    medianCycleDays: cycleDays.length === 0 ? null : Math.round(median(cycleDays) * 10) / 10,
  };
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  // An even-length list has no single middle element; average the two.
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}
