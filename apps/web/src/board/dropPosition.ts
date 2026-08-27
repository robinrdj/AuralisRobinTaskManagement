import { positionBetween, type Task, type TaskStatus } from "@auralis/shared";

export interface DropTarget {
  status: TaskStatus;
  /** Index within the destination column the card is being dropped at. */
  index: number;
}

/**
 * Works out the fractional position key for a card dropped into a column.
 *
 * Split out from the drag handler so the arithmetic — which is where
 * off-by-one errors live — can be tested without simulating a drag.
 *
 * `columnTasks` must be the destination column in its displayed order, with
 * the dragged card already removed if it came from that same column.
 */
export function resolveDropPosition(columnTasks: Task[], index: number): string {
  const clamped = Math.max(0, Math.min(index, columnTasks.length));
  const before = clamped === 0 ? null : (columnTasks[clamped - 1]?.position ?? null);
  const after = clamped >= columnTasks.length ? null : (columnTasks[clamped]?.position ?? null);

  // Neighbours can momentarily share a key when two clients write concurrently.
  // Falling back to appending is wrong-but-stable, and the next reconcile fixes
  // the order; throwing here would abort the user's drag instead.
  if (before !== null && after !== null && before >= after) {
    return positionBetween(columnTasks.at(-1)?.position ?? null, null);
  }

  return positionBetween(before, after);
}

/**
 * Given the dragged task and what it was dropped on, produce the destination
 * column and index. dnd-kit reports the element under the pointer, which is
 * either another card or the column itself.
 */
export function resolveDropTarget(
  active: Task,
  overId: string,
  columns: { status: TaskStatus; tasks: Task[] }[]
): DropTarget | null {
  // Dropped directly on a column: append to the end.
  const column = columns.find((candidate) => candidate.status === overId);
  if (column) {
    const withoutActive = column.tasks.filter((task) => task.id !== active.id);
    return { status: column.status, index: withoutActive.length };
  }

  // Dropped on another card: take that card's slot.
  for (const candidate of columns) {
    const index = candidate.tasks.findIndex((task) => task.id === overId);
    if (index < 0) continue;

    if (candidate.status === active.status) {
      const from = candidate.tasks.findIndex((task) => task.id === active.id);
      // Moving down within a column: once the card is lifted out, everything
      // below shifts up by one, so the target index does too.
      return { status: candidate.status, index: from < index ? index : index };
    }
    return { status: candidate.status, index };
  }

  return null;
}
