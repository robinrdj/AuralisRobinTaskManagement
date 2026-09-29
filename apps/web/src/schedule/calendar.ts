import type { Task } from "@auralis/shared";
import { addDays, weekdayIndex } from "./dates";

/** A month as "YYYY-MM". */
export type MonthKey = string;

export function monthOf(iso: string): MonthKey {
  return iso.slice(0, 7);
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, index] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * The days a month grid shows: whole weeks, Monday first, from the week
 * containing the 1st to the week containing the last day. Days outside the
 * month are included so the grid is always rectangular.
 */
export function monthGrid(month: MonthKey): string[] {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayIndex(first));
  const next = `${shiftMonth(month, 1)}-01`;
  const last = addDays(next, -1);
  const end = addDays(last, 6 - weekdayIndex(last));

  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * Tasks by due date. Within a day, unfinished work comes first and then the
 * more urgent, so the few chips a small cell has room for are the useful ones.
 */
export function groupByDueDate(tasks: readonly Task[]): Map<string, Task[]> {
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const list = grouped.get(task.dueDate) ?? [];
    list.push(task);
    grouped.set(task.dueDate, list);
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        Number(a.status === "completed") - Number(b.status === "completed") ||
        rank[a.priority] - rank[b.priority] ||
        a.title.localeCompare(b.title)
    );
  }
  return grouped;
}
