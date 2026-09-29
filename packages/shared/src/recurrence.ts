import { z } from "zod";

/**
 * Recurring tasks.
 *
 * A recurring task is an ordinary task with a rule attached. Completing it
 * leaves it completed — the history stays truthful — and puts a fresh copy on
 * the board with the next due date. The arithmetic lives here so the server
 * and the UI's "next due" hint can never disagree.
 */
export const TASK_RECURRENCES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];
export const taskRecurrenceSchema = z.enum(TASK_RECURRENCES);

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  monthly: "Every month",
};

/** Calendar days as UTC dates, so no timezone can shift the day. */
function parse(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * `months` after `anchor`, keeping the anchor's day of the month where it
 * exists and clamping to the month's last day where it does not — so a task
 * due on the 31st lands on 28 or 29 February, then back on 31 March, rather
 * than drifting to the 28th for good.
 */
function addMonths(anchor: Date, months: number): Date {
  const target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return target;
}

function step(anchor: Date, previous: Date, recurrence: TaskRecurrence, count: number): Date {
  switch (recurrence) {
    case "daily":
      return addDays(previous, 1);
    case "weekly":
      return addDays(previous, 7);
    case "monthly":
      return addMonths(anchor, count);
    case "weekdays": {
      let next = addDays(previous, 1);
      // 0 is Sunday, 6 is Saturday.
      while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addDays(next, 1);
      return next;
    }
  }
}

/**
 * The due date of the next occurrence.
 *
 * Counts forward from the current due date (or from today, for a task with
 * none) and keeps going until it reaches today or later. Finishing a weekly
 * task three weeks late therefore schedules the next one for the coming week,
 * not for a date that is already overdue.
 */
export function nextOccurrence(
  dueDate: string | null,
  recurrence: TaskRecurrence,
  today: string
): string {
  const anchor = parse(dueDate ?? today);
  const floor = parse(today);
  let next = anchor;
  // Bounded, so a corrupt date can never spin forever: 4000 daily steps is
  // over ten years of backlog.
  for (let count = 1; count <= 4000; count++) {
    next = step(anchor, next, recurrence, count);
    if (next.getTime() >= floor.getTime()) return format(next);
  }
  return format(next);
}
