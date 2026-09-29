import type { Task } from "@auralis/shared";
import { addDays, daysBetween, localDay } from "./dates";

export interface TimelineRow {
  task: Task;
  /** Day index of the bar's first day, from the start of the range. */
  start: number;
  /** Day index of its last day (the due date); always >= start. */
  end: number;
}

export interface TimelineArrow {
  fromRow: number;
  toRow: number;
  /**
   * The blocked task is due before the task it waits on finishes — a plan
   * that cannot be met as written.
   */
  conflict: boolean;
}

export interface TimelineLayout {
  /** The first day shown. */
  from: string;
  /** Number of days shown. */
  days: number;
  rows: TimelineRow[];
  arrows: TimelineArrow[];
  /** Tasks left out because they have no due date. */
  undated: number;
}

/** Longest range drawn; beyond this the bars would be too thin to read. */
const MAX_DAYS = 180;

/**
 * Lays out a Gantt-style timeline.
 *
 * Each task with a due date becomes a bar from the day it was created to the
 * day it is due. Rows are ordered by start, so work reads left to right and
 * top to bottom. Arrows join each blocker to the task it blocks, and are
 * flagged when the blocker is due after the blocked task.
 */
export function layoutTimeline(
  tasks: readonly Task[],
  dependencies: readonly { blockerId: string; blockedId: string }[],
  today: string
): TimelineLayout {
  const dated = tasks.filter((task) => task.dueDate);
  const spans = dated.map((task) => {
    const due = task.dueDate!;
    const created = localDay(task.createdAt);
    // Work created after its due date (an import with old dates, say) is a
    // one-day bar on the due date rather than a bar running backwards.
    return { task, first: created < due ? created : due, last: due };
  });

  if (spans.length === 0) {
    return { from: addDays(today, -3), days: 14, rows: [], arrows: [], undated: tasks.length };
  }

  let from = spans.reduce((min, span) => (span.first < min ? span.first : min), today);
  let to = spans.reduce((max, span) => (span.last > max ? span.last : max), today);
  from = addDays(from, -2);
  to = addDays(to, 3);
  // Keep a very long history from squeezing the present into a sliver: the
  // range is capped, anchored a month before today.
  if (daysBetween(from, to) + 1 > MAX_DAYS) {
    from = addDays(today, -30);
    if (daysBetween(from, to) + 1 > MAX_DAYS) to = addDays(from, MAX_DAYS - 1);
  }
  const days = daysBetween(from, to) + 1;

  spans.sort(
    (a, b) =>
      a.first.localeCompare(b.first) ||
      a.last.localeCompare(b.last) ||
      a.task.title.localeCompare(b.task.title)
  );

  const clamp = (value: number) => Math.min(Math.max(value, 0), days - 1);
  const rows: TimelineRow[] = spans.map((span) => ({
    task: span.task,
    start: clamp(daysBetween(from, span.first)),
    end: clamp(daysBetween(from, span.last)),
  }));

  const rowOf = new Map(rows.map((row, index) => [row.task.id, index]));
  const arrows: TimelineArrow[] = [];
  for (const { blockerId, blockedId } of dependencies) {
    const fromRow = rowOf.get(blockerId);
    const toRow = rowOf.get(blockedId);
    if (fromRow === undefined || toRow === undefined) continue;
    const blocker = rows[fromRow]!.task;
    const blocked = rows[toRow]!.task;
    arrows.push({
      fromRow,
      toRow,
      conflict: blocker.status !== "completed" && blocker.dueDate! > blocked.dueDate!,
    });
  }

  return { from, days, rows, arrows, undated: tasks.length - dated.length };
}
