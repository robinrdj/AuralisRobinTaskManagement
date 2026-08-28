import { useState } from "react";
import { STATUS_LABELS, cx } from "@/components/ui/labels";
import { Button } from "@/components/ui/primitives";
import {
  useAddDependencyMutation,
  useGetTaskDependenciesQuery,
  useRemoveDependencyMutation,
} from "@/store/api";
import type { Task } from "@auralis/shared";

/**
 * What a task waits on, and what waits on it.
 *
 * Blocked work is called out rather than prevented: the API rejects cycles,
 * but it does not stop you completing something out of order, because a tool
 * that refuses to let you record what happened is a tool people work around.
 */
export function Dependencies({
  task,
  candidates,
  onError,
}: {
  task: Task;
  /** Everything else on the board, for the picker. */
  candidates: Task[];
  onError: (message: string) => void;
}) {
  const { data, isLoading } = useGetTaskDependenciesQuery(task.id);
  const [addDependency, { isLoading: adding }] = useAddDependencyMutation();
  const [removeDependency] = useRemoveDependencyMutation();
  const [picking, setPicking] = useState(false);

  const blockedBy = data?.blockedBy ?? [];
  const blocking = data?.blocking ?? [];
  const linked = new Set([...blockedBy, ...blocking].map((entry) => entry.id));

  const openBlockers = blockedBy.filter((entry) => entry.status !== "completed");

  const add = async (blockerId: string) => {
    setPicking(false);
    try {
      await addDependency({ taskId: task.id, blockerId }).unwrap();
    } catch (error) {
      onError(readError(error) ?? "Could not link those tasks.");
    }
  };

  return (
    <section>
      <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Dependencies
      </h3>

      {openBlockers.length > 0 && (
        <p className="mb-2 rounded-[var(--radius-control)] border border-[var(--warning)] bg-[var(--warning-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]">
          Waiting on {openBlockers.length} unfinished{" "}
          {openBlockers.length === 1 ? "task" : "tasks"}.
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--text-muted)]">Loading…</p>
      ) : (
        <>
          <DependencyList
            label="Blocked by"
            tasks={blockedBy}
            emptyText="Nothing is holding this up."
            onRemove={(blockerId) => void removeDependency({ taskId: task.id, blockerId })}
          />
          <DependencyList
            label="Blocking"
            tasks={blocking}
            emptyText="Nothing is waiting on this."
          />
        </>
      )}

      {picking ? (
        <select
          autoFocus
          defaultValue=""
          aria-label="Choose a task this one waits on"
          onChange={(event) => event.target.value && void add(event.target.value)}
          onBlur={() => setPicking(false)}
          className="mt-2 h-8 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="" disabled>
            Choose a task…
          </option>
          {candidates
            .filter((entry) => entry.id !== task.id && !linked.has(entry.id))
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
        </select>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={adding}
          onClick={() => setPicking(true)}
        >
          + Add a blocker
        </Button>
      )}
    </section>
  );
}

function DependencyList({
  label,
  tasks,
  emptyText,
  onRemove,
}: {
  label: string;
  tasks: Task[];
  emptyText: string;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="mb-2">
      <p className="text-2xs font-medium text-[var(--text-muted)]">{label}</p>
      {tasks.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {tasks.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--status-${entry.status})` }}
              />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-sm",
                  entry.status === "completed"
                    ? "text-[var(--text-muted)] line-through"
                    : "text-[var(--text-primary)]"
                )}
              >
                {entry.title}
              </span>
              <span className="shrink-0 text-2xs text-[var(--text-muted)]">
                {STATUS_LABELS[entry.status]}
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Stop waiting on "${entry.title}"`}
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
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Surfaces the API's own message — "that would make them wait on each other". */
function readError(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const inner = (data as { error?: unknown }).error;
  if (typeof inner !== "object" || inner === null) return null;
  const message = (inner as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
