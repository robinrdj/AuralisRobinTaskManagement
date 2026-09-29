import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  formatRelativeDueDate,
  isOverdue,
  type Label,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@auralis/shared";
import { useGetSessionQuery, useGetTaskActivityQuery, type BoardMember } from "@/store/api";
import { PRIORITY_LABELS, STATUS_LABELS, cx } from "@/components/ui/labels";
import { Button, Skeleton } from "@/components/ui/primitives";
import { describeActivity, formatRelativeTime } from "./activityText";
import { Dependencies } from "./Dependencies";
import { Comments } from "./Comments";
import { LabelPicker } from "./LabelPicker";
import type { useTaskActions } from "@/hooks/useTaskActions";

type Actions = ReturnType<typeof useTaskActions>;

/**
 * Everything about one task.
 *
 * Fields save on blur rather than behind a Save button: there is no partial
 * state worth protecting, every change is undoable from its toast, and a form
 * that must be submitted is a form people leave half-finished. Escape closes,
 * and an edit in progress is committed first so nothing is silently lost.
 */
export function TaskDetailPanel({
  task,
  subtasks,
  siblings,
  members,
  labels = [],
  actions,
  readOnly = false,
  onClose,
}: {
  task: Task;
  subtasks: Task[];
  /** Other top-level tasks on the board, for the dependency picker. */
  siblings: Task[];
  members: BoardMember[];
  /** Every label on the board, for the picker. */
  labels?: Label[];
  actions: Actions;
  /** Disables every control, for someone with view-only access. */
  readOnly?: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const { data: activity = [], isLoading: activityLoading } = useGetTaskActivityQuery(task.id);
  const { data: session } = useGetSessionQuery();
  const isBoardOwner =
    session?.boards.find((board) => board.id === task.boardId)?.role === "owner";

  // Escape closes; Tab is trapped inside for as long as the panel is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // A control that uses Escape itself (an open suggestion list) gets it first.
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('[data-owns-escape="true"]')) return;
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const completedSubtasks = subtasks.filter((child) => child.status === "completed").length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${task.title}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="scrollbar-slim flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-base)] shadow-[var(--shadow-overlay)]"
      >
        <header className="sticky top-0 z-10 flex items-start gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <InlineText
              value={task.title}
              label="Task title"
              disabled={readOnly}
              className="text-base font-semibold leading-snug text-[var(--text-primary)]"
              onCommit={(title) => {
                if (title !== task.title) void actions.update(task, { title });
              }}
            />
            <p className="mt-0.5 text-2xs text-[var(--text-muted)]">
              Created {formatRelativeTime(task.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* A disabled fieldset disables every control inside it in one place. */}
        <fieldset disabled={readOnly} className="flex min-w-0 flex-1 flex-col gap-5 p-4">
          <section className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="detail-status">
              <select
                id="detail-status"
                value={task.status}
                onChange={(event) =>
                  void actions.update(task, { status: event.target.value as TaskStatus })
                }
                className={CONTROL_CLASS}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority" htmlFor="detail-priority">
              <select
                id="detail-priority"
                value={task.priority}
                onChange={(event) =>
                  void actions.update(task, { priority: event.target.value as TaskPriority })
                }
                className={CONTROL_CLASS}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Due date" htmlFor="detail-due">
              <input
                id="detail-due"
                type="date"
                value={task.dueDate ?? ""}
                onChange={(event) =>
                  void actions.update(task, { dueDate: event.target.value || null })
                }
                className={CONTROL_CLASS}
              />
              {task.dueDate && (
                <p
                  className={cx(
                    "mt-1 text-2xs",
                    isOverdue(task) ? "text-[var(--danger)]" : "text-[var(--text-muted)]"
                  )}
                >
                  {formatRelativeDueDate(task.dueDate)}
                </p>
              )}
            </Field>

            {members.length > 1 && (
              <Field label="Assignee" htmlFor="detail-assignee">
                <select
                  id="detail-assignee"
                  value={task.assigneeId ?? ""}
                  onChange={(event) =>
                    void actions.update(task, { assigneeId: event.target.value || null })
                  }
                  className={CONTROL_CLASS}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </section>

          <LabelPicker
            taskId={task.id}
            boardId={task.boardId}
            labels={labels}
            readOnly={readOnly}
          />

          <section>
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Description
            </h3>
            <InlineText
              value={task.description}
              label="Task description"
              multiline
              placeholder="Add any detail worth remembering."
              className="w-full text-sm leading-relaxed text-[var(--text-secondary)]"
              onCommit={(description) => {
                if (description !== task.description) {
                  void actions.update(task, { description });
                }
              }}
            />
          </section>

          <Subtasks
            parent={task}
            subtasks={subtasks}
            completed={completedSubtasks}
            actions={actions}
          />

          <Dependencies
            task={task}
            candidates={siblings}
            onError={(message) => setDependencyError(message)}
          />
          {dependencyError && (
            <p role="alert" className="-mt-3 text-xs text-[var(--danger)]">
              {dependencyError}
            </p>
          )}

          <Comments
            taskId={task.id}
            members={members}
            currentUserId={session?.user.id}
            isOwner={isBoardOwner}
            readOnly={readOnly}
          />

          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              History
            </h3>
            {activityLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-4/5" />
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Nothing recorded yet.</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {activity.map((entry) => {
                  const line = describeActivity(entry);
                  return (
                    <li key={entry.id} className="flex gap-2.5 text-xs">
                      <span
                        aria-hidden="true"
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-strong)]"
                      />
                      <div className="min-w-0">
                        <p className="text-[var(--text-primary)]">
                          {line.summary}
                          <span className="ml-1.5 text-[var(--text-muted)]">
                            {formatRelativeTime(entry.createdAt)}
                          </span>
                        </p>
                        {line.details.map((detail) => (
                          <p key={detail} className="mt-0.5 text-[var(--text-muted)]">
                            {detail}
                          </p>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </fieldset>

        {!readOnly && (
          <footer className="sticky bottom-0 flex justify-end border-t border-[var(--border-subtle)] bg-[var(--surface-base)]/95 px-4 py-3 backdrop-blur">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                // Deletion is undoable from its toast, so it does not need a
                // confirmation dialog in front of it.
                void actions.remove(task);
                onClose();
              }}
            >
              Delete task
            </Button>
          </footer>
        )}
      </motion.aside>
    </div>
  );
}

function Subtasks({
  parent,
  subtasks,
  completed,
  actions,
}: {
  parent: Task;
  subtasks: Task[];
  completed: number;
  actions: Actions;
}) {
  const [draft, setDraft] = useState("");

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await actions.create({ title, parentId: parent.id, status: "todo" });
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Subtasks
        {subtasks.length > 0 && (
          <span className="tabular-nums normal-case tracking-normal">
            {completed} of {subtasks.length} done
          </span>
        )}
      </h3>

      {subtasks.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {subtasks.map((child) => (
            <li key={child.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={child.status === "completed"}
                onChange={(event) =>
                  void actions.update(child, {
                    status: event.target.checked ? "completed" : "todo",
                  })
                }
                aria-label={`Mark "${child.title}" ${
                  child.status === "completed" ? "not done" : "done"
                }`}
                className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
              />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-sm",
                  child.status === "completed"
                    ? "text-[var(--text-muted)] line-through"
                    : "text-[var(--text-primary)]"
                )}
              >
                {child.title}
              </span>
              <button
                type="button"
                onClick={() => void actions.remove(child)}
                aria-label={`Delete subtask "${child.title}"`}
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a subtask"
          aria-label="New subtask title"
          className={cx(CONTROL_CLASS, "flex-1")}
        />
        <Button type="submit" size="sm" disabled={draft.trim() === ""}>
          Add
        </Button>
      </form>
    </section>
  );
}

/**
 * Click-to-edit text that commits on blur or Enter and reverts on Escape.
 *
 * The displayed value re-syncs whenever the task changes underneath — a
 * realtime edit from another client must not be masked by a stale local draft.
 */
function InlineText({
  value,
  label,
  onCommit,
  className,
  placeholder,
  multiline = false,
  disabled = false,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    // An empty title would leave a nameless card, so a blank reverts.
    if (!multiline && trimmed === "") {
      setDraft(value);
      return;
    }
    onCommit(trimmed);
  };

  const shared = {
    value: draft,
    "aria-label": label,
    placeholder,
    disabled,
    onFocus: () => setEditing(true),
    onBlur: commit,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setDraft(value);
        setEditing(false);
        (event.target as HTMLElement).blur();
      }
      if (event.key === "Enter" && !multiline) {
        event.preventDefault();
        (event.target as HTMLElement).blur();
      }
    },
    className: cx(
      "w-full resize-none rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 py-1 -mx-1.5",
      "hover:border-[var(--border-default)] focus:border-[var(--accent)] focus:bg-[var(--surface-raised)] focus:outline-none",
      className
    ),
  };

  return multiline ? (
    <textarea
      {...shared}
      rows={Math.max(2, draft.split("\n").length)}
      onChange={(event) => setDraft(event.target.value)}
    />
  ) : (
    <input {...shared} onChange={(event) => setDraft(event.target.value)} />
  );
}

const CONTROL_CLASS =
  "h-8 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
