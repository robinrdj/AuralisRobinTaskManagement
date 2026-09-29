import type { Task } from "@auralis/shared";

export interface EstimateRow {
  task: Task;
  /** Null when the task has tracked time but no estimate. */
  estimateSeconds: number | null;
  trackedSeconds: number;
  /** Tracked as a share of the estimate: 1 is exactly on it. Null without an estimate. */
  ratio: number | null;
}

/**
 * Estimate against actual, for every task that has either.
 *
 * Furthest over the estimate first — those are the ones worth a look — then
 * tasks with time but no estimate, by how much time they have taken.
 */
export function estimateRows(
  tasks: readonly Task[],
  trackedByTask: ReadonlyMap<string, number>
): EstimateRow[] {
  const rows: EstimateRow[] = [];
  for (const task of tasks) {
    const tracked = trackedByTask.get(task.id) ?? 0;
    const estimate = task.estimateMinutes ? task.estimateMinutes * 60 : null;
    if (estimate === null && tracked === 0) continue;
    rows.push({
      task,
      estimateSeconds: estimate,
      trackedSeconds: tracked,
      ratio: estimate === null ? null : tracked / estimate,
    });
  }
  return rows.sort((a, b) => {
    if (a.ratio !== null && b.ratio !== null) return b.ratio - a.ratio;
    if (a.ratio !== null) return -1;
    if (b.ratio !== null) return 1;
    return b.trackedSeconds - a.trackedSeconds;
  });
}
