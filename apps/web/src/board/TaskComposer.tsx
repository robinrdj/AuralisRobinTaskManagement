import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  todayISO,
  type CreateTaskInput,
  type TaskPriority,
  type TaskStatus,
} from "@auralis/shared";
import { Button } from "@/components/ui/primitives";
import { PRIORITY_LABELS, STATUS_LABELS, cx } from "@/components/ui/labels";
import type { BoardMember } from "@/store/api";

/**
 * The create-task dialog.
 *
 * v1 gave task creation its own route at `/`, which meant adding a task took
 * you off the board and back again. Here it is a dialog over the board, so the
 * context you are adding to stays visible behind it.
 */
export function TaskComposer({
  initialStatus,
  members,
  onClose,
  onCreate,
}: {
  initialStatus: TaskStatus;
  members: BoardMember[];
  onClose: () => void;
  onCreate: (input: CreateTaskInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Escape closes, and focus is trapped inside for as long as the dialog is up.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A task needs a title.");
      titleRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        title: trimmed,
        description: description.trim(),
        status,
        priority,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-heading"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="w-full max-w-lg rounded-t-2xl border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)] sm:rounded-[var(--radius-card)]"
      >
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2
              id="composer-heading"
              className="text-lg font-semibold text-[var(--text-primary)]"
            >
              New task
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
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
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="composer-title"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Title
            </label>
            <input
              id="composer-title"
              ref={titleRef}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (error) setError(null);
              }}
              placeholder="What needs doing?"
              aria-invalid={error !== null}
              aria-describedby={error ? "composer-title-error" : undefined}
              className={cx(
                "h-10 rounded-[var(--radius-control)] border bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none",
                error
                  ? "border-[var(--danger)] focus:border-[var(--danger)]"
                  : "border-[var(--border-default)] focus:border-[var(--accent)]"
              )}
            />
            {error && (
              <p
                id="composer-title-error"
                role="alert"
                className="text-xs text-[var(--danger)]"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="composer-description"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Description <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              id="composer-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Any detail worth remembering."
              className="resize-y rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="composer-status">
              <select
                id="composer-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                className={SELECT_CLASS}
              >
                {TASK_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority" htmlFor="composer-priority">
              <select
                id="composer-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className={SELECT_CLASS}
              >
                {TASK_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Due date" htmlFor="composer-due">
              <input
                id="composer-due"
                type="date"
                value={dueDate}
                min={todayISO()}
                onChange={(event) => setDueDate(event.target.value)}
                className={SELECT_CLASS}
              />
            </Field>

            {members.length > 1 && (
              <Field label="Assignee" htmlFor="composer-assignee">
                <select
                  id="composer-assignee"
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  className={SELECT_CLASS}
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
          </div>

          <div className="mt-1 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add task"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none";

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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
    </div>
  );
}
