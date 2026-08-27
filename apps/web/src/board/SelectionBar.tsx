import { motion } from "motion/react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type UpdateTaskInput,
} from "@auralis/shared";
import { Button } from "@/components/ui/primitives";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/components/ui/labels";

/**
 * Bulk actions for the current selection.
 *
 * Deletion is immediate and undoable from the toast rather than guarded by a
 * confirm dialog: a modal interrupts every deletion to protect against the
 * rare mistaken one, while undo costs nothing until you actually need it.
 */
export function SelectionBar({
  selected,
  onClear,
  onUpdate,
  onDelete,
}: {
  selected: Task[];
  onClear: () => void;
  onUpdate: (updates: UpdateTaskInput) => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      role="toolbar"
      aria-label="Bulk actions"
      className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[var(--accent)] bg-[var(--accent-subtle)] px-3 py-2 md:mx-6"
    >
      <span className="text-sm font-medium text-[var(--accent-text)]">
        {selected.length} selected
      </span>

      <label className="ml-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        Move to
        <select
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            onUpdate({ status: event.target.value as Task["status"] });
            event.target.value = "";
          }}
          className="h-7 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--text-primary)]"
        >
          <option value="" disabled>
            Choose…
          </option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        Priority
        <select
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            onUpdate({ priority: event.target.value as Task["priority"] });
            event.target.value = "";
          }}
          className="h-7 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--text-primary)]"
        >
          <option value="" disabled>
            Choose…
          </option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
