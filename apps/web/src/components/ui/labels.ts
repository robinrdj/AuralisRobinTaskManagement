import type { TaskPriority, TaskStatus } from "@auralis/shared";

/**
 * Non-component exports live here rather than beside the components.
 *
 * A module that exports both a component and a constant breaks React Fast
 * Refresh — editing the constant forces a full reload instead of preserving
 * state, which is exactly the wrong trade during UI work.
 */

/** Joins class names, dropping anything falsy. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Priority and status are always shown as a colour *plus* a word — around one
 * man in twelve cannot reliably separate the high and medium hues.
 */
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  inprogress: "In progress",
  review: "In review",
  completed: "Done",
};
