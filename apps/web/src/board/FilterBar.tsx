import { useEffect, useState } from "react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@auralis/shared";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  clearFilters,
  hasActiveFilters,
  setFilters,
  setSort,
  setSelectionMode,
  type SortKey,
} from "@/store/uiSlice";
import { recordFilterUse } from "@/store/tourSlice";
import { Button } from "@/components/ui/primitives";
import { cx, PRIORITY_LABELS, STATUS_LABELS } from "@/components/ui/labels";
import type { BoardMember } from "@/store/api";
import type { PresenceMember } from "@/hooks/useRealtimeBoard";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "position", label: "Manual order" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
  { value: "createdAt", label: "Created" },
];

export function FilterBar({
  members,
  connected,
  presentMembers,
  readOnly = false,
  onAddTask,
  importExport,
}: {
  boardId: string;
  members: BoardMember[];
  connected: boolean;
  presentMembers: PresenceMember[];
  readOnly?: boolean;
  onAddTask: () => void;
  /** The export/import menu, passed in so the bar stays presentational. */
  importExport?: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const { filters, sortBy, sortDirection, selectionMode } = useAppSelector((state) => state.ui);
  const [search, setSearch] = useState(filters.search);
  const [expanded, setExpanded] = useState(false);

  /*
   * Debounced so typing does not re-filter on every keystroke. The input stays
   * fully controlled by local state, so it never lags behind the user the way
   * a debounced controlled value does.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch(setFilters({ search }));
      if (search) dispatch(recordFilterUse());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, dispatch]);

  const active = hasActiveFilters(filters);

  return (
    <div
      data-tour="filter-bar"
      className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]/85 px-4 py-3 backdrop-blur-md md:px-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M11 11l3 3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <select
          value={`${sortBy}:${sortDirection}`}
          onChange={(event) => {
            const [by, direction] = event.target.value.split(":");
            dispatch(setSort({ by: by as SortKey, direction: direction as "asc" | "desc" }));
            dispatch(recordFilterUse());
          }}
          aria-label="Sort tasks"
          className="h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <optgroup key={option.value} label={option.label}>
              <option value={`${option.value}:asc`}>{option.label} ↑</option>
              <option value={`${option.value}:desc`}>{option.label} ↓</option>
            </optgroup>
          ))}
        </select>

        <Button
          size="md"
          variant={filters.overdueOnly ? "primary" : "secondary"}
          data-tour="filter-overdue"
          aria-pressed={filters.overdueOnly}
          onClick={() => {
            dispatch(setFilters({ overdueOnly: !filters.overdueOnly }));
            dispatch(recordFilterUse());
          }}
        >
          Overdue
        </Button>

        <Button
          size="md"
          variant={expanded ? "primary" : "secondary"}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          Filters
          {active && (
            <span
              className="ml-1 h-1.5 w-1.5 rounded-full bg-current"
              aria-label="filters active"
            />
          )}
        </Button>

        {!readOnly && (
          <Button
            size="md"
            variant={selectionMode ? "primary" : "secondary"}
            aria-pressed={selectionMode}
            onClick={() => dispatch(setSelectionMode(!selectionMode))}
          >
            Select
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <PresenceStack members={presentMembers} connected={connected} />
          {importExport}
          {!readOnly && (
            <Button size="md" variant="primary" data-tour="new-task" onClick={onAddTask}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              New task
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-[var(--border-subtle)] pt-3">
          <FilterGroup label="Priority">
            {TASK_PRIORITIES.map((priority) => (
              <Chip
                key={priority}
                active={filters.priorities.includes(priority)}
                color={`var(--priority-${priority})`}
                onClick={() => {
                  const next = filters.priorities.includes(priority)
                    ? filters.priorities.filter((value) => value !== priority)
                    : [...filters.priorities, priority];
                  dispatch(setFilters({ priorities: next }));
                  dispatch(recordFilterUse());
                }}
              >
                {PRIORITY_LABELS[priority]}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Status">
            {TASK_STATUSES.map((status) => (
              <Chip
                key={status}
                active={filters.statuses.includes(status)}
                color={`var(--status-${status})`}
                onClick={() => {
                  const next = filters.statuses.includes(status)
                    ? filters.statuses.filter((value) => value !== status)
                    : [...filters.statuses, status];
                  dispatch(setFilters({ statuses: next }));
                  dispatch(recordFilterUse());
                }}
              >
                {STATUS_LABELS[status]}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Due between">
            {/*
              Each bound clears on its own. In v1 the only way to clear a date
              range was to disable the whole filter bar, which then hid the
              controls you needed to get back.
            */}
            <DateInput
              label="From"
              value={filters.dueFrom}
              onChange={(value) => dispatch(setFilters({ dueFrom: value }))}
            />
            <DateInput
              label="To"
              value={filters.dueTo}
              onChange={(value) => dispatch(setFilters({ dueTo: value }))}
            />
          </FilterGroup>

          {members.length > 1 && (
            <FilterGroup label="Assignee">
              {members.map((member) => (
                <Chip
                  key={member.userId}
                  active={filters.assigneeIds.includes(member.userId)}
                  color={member.color}
                  onClick={() => {
                    const next = filters.assigneeIds.includes(member.userId)
                      ? filters.assigneeIds.filter((id) => id !== member.userId)
                      : [...filters.assigneeIds, member.userId];
                    dispatch(setFilters({ assigneeIds: next }));
                    dispatch(recordFilterUse());
                  }}
                >
                  {member.name}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {active && (
            <Button
              size="sm"
              variant="ghost"
              className="self-end"
              onClick={() => {
                dispatch(clearFilters());
                setSearch("");
              }}
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </legend>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent text-white"
          : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
      )}
      style={active ? { backgroundColor: color } : undefined}
    >
      {!active && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
      {label}
      <input
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-7 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Clear ${label.toLowerCase()} date`}
          className="text-[var(--text-muted)] hover:text-[var(--danger)]"
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
    </label>
  );
}

/** Avatars of everyone currently looking at this board. */
function PresenceStack({
  members,
  connected,
}: {
  members: PresenceMember[];
  connected: boolean;
}) {
  if (members.length === 0) {
    return (
      <span
        className="flex items-center gap-1.5 text-2xs text-[var(--text-muted)]"
        title={connected ? "Live updates on" : "Reconnecting"}
      >
        <span
          className={cx(
            "h-1.5 w-1.5 rounded-full",
            connected ? "bg-[var(--success)]" : "animate-pulse bg-[var(--warning)]"
          )}
        />
        {connected ? "Live" : "Offline"}
      </span>
    );
  }

  return (
    <div
      className="flex items-center -space-x-1.5"
      aria-label={`${members.length} people viewing`}
    >
      {members.slice(0, 4).map((member) => (
        <span
          key={member.userId}
          title={member.name}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface-sunken)] text-2xs font-semibold text-white"
          style={{ backgroundColor: member.color }}
        >
          {member.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {members.length > 4 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface-sunken)] bg-[var(--surface-active)] text-2xs font-semibold text-[var(--text-secondary)]">
          +{members.length - 4}
        </span>
      )}
    </div>
  );
}
