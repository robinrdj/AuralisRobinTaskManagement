import {
  isOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskStatus,
} from "@auralis/shared";
import type { Filters, SortKey } from "@/store/uiSlice";

/**
 * Turns the flat task list into what the board renders.
 *
 * Kept as pure functions rather than a hook so the filtering and sorting rules
 * can be tested directly, without mounting a component or a store.
 */

export interface BoardColumn {
  status: TaskStatus;
  tasks: Task[];
  /** Count before filtering, so a column can say "3 of 12 shown". */
  totalCount: number;
}

const PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  TASK_PRIORITIES.map((priority, index) => [priority, index])
);

/** Case-insensitive match across title and description. */
function matchesSearch(task: Task, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle)
  );
}

export function matchesFilters(task: Task, filters: Filters, now = new Date()): boolean {
  if (!matchesSearch(task, filters.search.trim())) return false;
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority))
    return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;

  if (filters.assigneeIds.length > 0) {
    if (!task.assigneeId || !filters.assigneeIds.includes(task.assigneeId)) return false;
  }

  // Date bounds compare ISO strings, which is only valid because they are
  // zero-padded ISO calendar dates. This is the comparison v1 got wrong.
  if (filters.dueFrom && (!task.dueDate || task.dueDate < filters.dueFrom)) return false;
  if (filters.dueTo && (!task.dueDate || task.dueDate > filters.dueTo)) return false;

  if (filters.overdueOnly && !isOverdue(task, now)) return false;

  return true;
}

function compareTasks(a: Task, b: Task, sortBy: SortKey): number {
  switch (sortBy) {
    case "position":
      return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

    case "priority":
      // Highest priority first, which is the useful default for this key.
      return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);

    case "dueDate": {
      // Undated tasks sort last in both directions rather than clumping at
      // whichever end an empty string happens to land on.
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    }

    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

    case "createdAt":
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

    default:
      return 0;
  }
}

export interface BuildBoardOptions {
  tasks: Task[];
  filters: Filters;
  sortBy: SortKey;
  sortDirection: "asc" | "desc";
  /** Subtasks are shown inside their parent, not as top-level cards. */
  includeSubtasks?: boolean;
  now?: Date;
}

export function buildBoard({
  tasks,
  filters,
  sortBy,
  sortDirection,
  includeSubtasks = false,
  now = new Date(),
}: BuildBoardOptions): BoardColumn[] {
  const totals = new Map<TaskStatus, number>();
  for (const status of TASK_STATUSES) totals.set(status, 0);

  const visible: Task[] = [];
  for (const task of tasks) {
    if (!includeSubtasks && task.parentId) continue;
    totals.set(task.status, (totals.get(task.status) ?? 0) + 1);
    if (matchesFilters(task, filters, now)) visible.push(task);
  }

  const direction = sortDirection === "desc" ? -1 : 1;
  // Undated tasks stay last even when the direction flips, so reversing the
  // sort does not surface a wall of tasks with no due date.
  const undatedLast = sortBy === "dueDate";

  const byStatus = new Map<TaskStatus, Task[]>();
  for (const status of TASK_STATUSES) byStatus.set(status, []);
  for (const task of visible) byStatus.get(task.status)?.push(task);

  return TASK_STATUSES.map((status) => {
    const column = byStatus.get(status) ?? [];
    column.sort((a, b) => {
      if (undatedLast) {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
      }
      return compareTasks(a, b, sortBy) * direction;
    });
    return { status, tasks: column, totalCount: totals.get(status) ?? 0 };
  });
}

/** Subtasks grouped by parent id, for rendering inside a parent card. */
export function groupSubtasks(tasks: Task[]): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.parentId) continue;
    const siblings = grouped.get(task.parentId) ?? [];
    siblings.push(task);
    grouped.set(task.parentId, siblings);
  }
  for (const siblings of grouped.values()) {
    siblings.sort((a, b) => (a.position < b.position ? -1 : 1));
  }
  return grouped;
}

export interface BoardStats {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  completionRate: number;
}

export function summarise(tasks: Task[], now = new Date()): BoardStats {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  let completed = 0;
  let overdue = 0;
  let dueToday = 0;

  for (const task of tasks) {
    if (task.status === "completed") completed++;
    if (isOverdue(task, now)) overdue++;
    if (task.dueDate === today && task.status !== "completed") dueToday++;
  }

  return {
    total: tasks.length,
    completed,
    overdue,
    dueToday,
    completionRate: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
  };
}
