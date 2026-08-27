import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { daysUntil, formatRelativeDueDate, isOverdue, type Task } from "@auralis/shared";
import { cx, PRIORITY_LABELS, STATUS_LABELS } from "@/components/ui/labels";

export interface TaskCardProps {
  task: Task;
  subtaskCount?: number;
  completedSubtasks?: number;
  selected?: boolean;
  selectionMode?: boolean;
  assigneeColor?: string;
  assigneeName?: string;
  onToggleSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  /** Set while this card is the drag overlay, which must not re-register as sortable. */
  isOverlay?: boolean;
}

/**
 * A single task.
 *
 * Priority reads as a coloured left edge rather than a badge stripe across the
 * top — it is scannable down a column without competing with the title for
 * attention, and the badge still carries the word for anyone who cannot
 * separate the hues.
 */
function TaskCardImpl({
  task,
  subtaskCount = 0,
  completedSubtasks = 0,
  selected = false,
  selectionMode = false,
  assigneeColor,
  assigneeName,
  onToggleSelect,
  onOpen,
  isOverlay = false,
}: TaskCardProps) {
  const sortable = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: isOverlay,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const overdue = isOverdue(task);
  const dueSoon =
    !overdue && task.dueDate !== null && task.status !== "completed"
      ? daysUntil(task.dueDate) <= 2
      : false;

  return (
    <article
      ref={isOverlay ? undefined : setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        borderLeftColor: `var(--priority-${task.priority})`,
      }}
      className={cx(
        "group relative rounded-[var(--radius-card)] border border-[var(--border-subtle)]",
        "border-l-[3px] bg-[var(--surface-raised)] p-3",
        "shadow-[var(--shadow-card)] transition-shadow duration-150",
        "hover:shadow-[var(--shadow-raised)]",
        // The original stays in the flow but fades, so the column keeps its
        // height and the other cards do not jump while dragging.
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "rotate-[1.5deg] cursor-grabbing shadow-[var(--shadow-lifted)]",
        selected &&
          "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface-sunken)]",
        task.status === "completed" && "opacity-75"
      )}
      aria-label={`${task.title}. ${PRIORITY_LABELS[task.priority]} priority. ${
        STATUS_LABELS[task.status]
      }.${task.dueDate ? ` ${formatRelativeDueDate(task.dueDate)}.` : ""}`}
    >
      <div className="flex items-start gap-2">
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(task.id)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            aria-label={`Select ${task.title}`}
          />
        )}

        {/*
          The drag handle is the card body rather than a separate grip, but it
          is a button so keyboard users get the same affordance: focus it and
          use space plus the arrow keys, which dnd-kit wires up for free.
        */}
        <button
          type="button"
          ref={isOverlay ? undefined : sortable.setActivatorNodeRef}
          {...(isOverlay ? {} : listeners)}
          {...(isOverlay ? {} : attributes)}
          onClick={() => onOpen?.(task.id)}
          className="min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
        >
          <h3
            className={cx(
              "text-sm font-medium leading-snug text-[var(--text-primary)]",
              task.status === "completed" && "line-through decoration-[var(--text-muted)]"
            )}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {task.description}
            </p>
          )}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide"
          style={{
            color: `var(--priority-${task.priority})`,
            backgroundColor: `color-mix(in oklch, var(--priority-${task.priority}) 14%, transparent)`,
          }}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>

        {task.dueDate && (
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-1.5 py-0.5 text-2xs font-medium",
              overdue
                ? "bg-[var(--danger-subtle)] text-[var(--danger)]"
                : dueSoon
                  ? "bg-[var(--warning-subtle)] text-[var(--warning)]"
                  : "text-[var(--text-muted)]"
            )}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect
                x="2"
                y="3"
                width="12"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
            {formatRelativeDueDate(task.dueDate)}
          </span>
        )}

        {subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1 text-2xs text-[var(--text-muted)]">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 8.5l3 3 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {completedSubtasks}/{subtaskCount}
          </span>
        )}

        {assigneeName && (
          <span
            className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-2xs font-semibold text-white"
            style={{ backgroundColor: assigneeColor ?? "var(--text-muted)" }}
            title={assigneeName}
          >
            {assigneeName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Re-renders only when this card's own data changes. With a few hundred cards
 * on screen, an unmemoised card means every drag frame re-renders the board.
 */
export const TaskCard = memo(TaskCardImpl, (prev, next) => {
  return (
    prev.task === next.task &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.subtaskCount === next.subtaskCount &&
    prev.completedSubtasks === next.completedSubtasks &&
    prev.assigneeColor === next.assigneeColor &&
    prev.assigneeName === next.assigneeName &&
    prev.isOverlay === next.isOverlay
  );
});
