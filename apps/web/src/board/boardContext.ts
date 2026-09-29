import { createContext } from "react";
import type { Label, LabelAssignment } from "@auralis/shared";

/**
 * The labels on each task, keyed by task id.
 *
 * Provided once by the board rather than threaded through columns as a prop:
 * cards read it directly, and a card re-renders when the map changes even
 * though it is memoised on its props.
 */
export const TaskLabelsContext = createContext<Map<string, Label[]>>(new Map());

/** Resolves assignments to label objects, dropping any whose label has gone. */
export function groupLabels(
  labels: readonly Label[],
  assignments: readonly LabelAssignment[]
): Map<string, Label[]> {
  const byId = new Map(labels.map((label) => [label.id, label]));
  const grouped = new Map<string, Label[]>();
  for (const { taskId, labelId } of assignments) {
    const label = byId.get(labelId);
    if (!label) continue;
    const list = grouped.get(taskId) ?? [];
    list.push(label);
    grouped.set(taskId, list);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return grouped;
}
