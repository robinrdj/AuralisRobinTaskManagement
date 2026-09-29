import { useEffect, useMemo, useRef } from "react";
import { formatDate, isOverdue, todayISO } from "@auralis/shared";
import { useAppDispatch } from "@/store";
import { useGetBoardDependenciesQuery } from "@/store/api";
import { inspectTask } from "@/store/uiSlice";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { cx, PRIORITY_LABELS, STATUS_LABELS } from "@/components/ui/labels";
import { addDays, daysBetween, parseDay, weekdayIndex } from "./dates";
import { layoutTimeline, type TimelineLayout } from "./timeline";
import { ScheduleShell, type ScheduleData } from "./ScheduleShell";

const DAY_WIDTH = 28;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 44;

/**
 * Work drawn across time: each task is a bar from when it was created to
 * when it is due, and arrows show what waits on what. An arrow turns red when
 * a task is due before something it depends on — a plan that cannot be met.
 */
export function TimelinePage({ boardId, readOnly }: { boardId: string; readOnly: boolean }) {
  return (
    <ScheduleShell boardId={boardId} readOnly={readOnly} title="Timeline">
      {(data) => <Timeline boardId={boardId} data={data} />}
    </ScheduleShell>
  );
}

function Timeline({ boardId, data }: { boardId: string; data: ScheduleData }) {
  const { data: dependencies = [], isLoading } = useGetBoardDependenciesQuery(boardId);
  const today = todayISO();
  const layout = useMemo(
    // Subtasks live inside their parent; drawing them too would double the rows.
    () =>
      layoutTimeline(
        data.visible.filter((task) => !task.parentId),
        dependencies,
        today
      ),
    [data.visible, dependencies, today]
  );

  if (data.isLoading || isLoading) return <Skeleton className="h-[24rem] w-full" />;

  if (layout.rows.length === 0) {
    return (
      <EmptyState
        title="Nothing to draw yet"
        description="The timeline shows tasks that have a due date. Give a task one and it appears here."
      />
    );
  }

  const conflicts = layout.arrows.filter((arrow) => arrow.conflict);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span>
          {layout.rows.length} scheduled {layout.rows.length === 1 ? "task" : "tasks"}
        </span>
        {layout.undated > 0 && (
          <span className="text-[var(--text-muted)]">{layout.undated} without a due date</span>
        )}
        {conflicts.length > 0 ? (
          <span role="status" className="font-medium text-[var(--danger)]">
            {conflicts.length} {conflicts.length === 1 ? "task is" : "tasks are"} due before
            something {conflicts.length === 1 ? "it waits" : "they wait"} on
          </span>
        ) : (
          layout.arrows.length > 0 && <span>Dependencies are in a workable order</span>
        )}
      </div>

      {conflicts.length > 0 && <ConflictList layout={layout} />}
      <Chart layout={layout} today={today} />
    </div>
  );
}

function ConflictList({ layout }: { layout: TimelineLayout }) {
  const dispatch = useAppDispatch();
  return (
    <ul className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-subtle)] px-3 py-2 text-xs">
      {layout.arrows
        .filter((arrow) => arrow.conflict)
        .map((arrow) => {
          const blocker = layout.rows[arrow.fromRow]!.task;
          const blocked = layout.rows[arrow.toRow]!.task;
          return (
            <li key={`${blocker.id}-${blocked.id}`} className="text-[var(--text-primary)]">
              <button
                type="button"
                className="font-medium underline-offset-2 hover:underline"
                onClick={() => dispatch(inspectTask(blocked.id))}
              >
                {blocked.title}
              </button>{" "}
              is due {formatDate(blocked.dueDate)}, but waits on{" "}
              <button
                type="button"
                className="font-medium underline-offset-2 hover:underline"
                onClick={() => dispatch(inspectTask(blocker.id))}
              >
                {blocker.title}
              </button>
              , due {formatDate(blocker.dueDate)}.
            </li>
          );
        })}
    </ul>
  );
}

function Chart({ layout, today }: { layout: TimelineLayout; today: string }) {
  const dispatch = useAppDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const width = layout.days * DAY_WIDTH;
  const height = layout.rows.length * ROW_HEIGHT;
  const todayIndex = daysBetween(layout.from, today);
  const days = Array.from({ length: layout.days }, (_, index) => addDays(layout.from, index));

  // Open on today, with a little of the recent past in view.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollLeft = Math.max(0, todayIndex * DAY_WIDTH - 5 * DAY_WIDTH);
  }, [todayIndex]);

  return (
    <div className="flex overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-base)]">
      {/* Titles, pinned while the chart scrolls sideways. */}
      <ol
        className="w-32 shrink-0 border-r border-[var(--border-subtle)] sm:w-56"
        aria-label="Scheduled tasks"
      >
        <li
          aria-hidden="true"
          style={{ height: HEADER_HEIGHT }}
          className="border-b border-[var(--border-subtle)]"
        />
        {layout.rows.map((row) => (
          <li
            key={row.task.id}
            style={{ height: ROW_HEIGHT }}
            className="flex items-center px-2"
          >
            <button
              type="button"
              onClick={() => dispatch(inspectTask(row.task.id))}
              className={cx(
                "w-full truncate text-left text-xs hover:underline",
                row.task.status === "completed"
                  ? "text-[var(--text-muted)] line-through"
                  : "text-[var(--text-primary)]"
              )}
              title={row.task.title}
            >
              {row.task.title}
            </button>
          </li>
        ))}
      </ol>

      <div ref={scrollRef} className="scrollbar-slim min-w-0 flex-1 overflow-x-auto">
        <div className="relative" style={{ width, height: HEADER_HEIGHT + height }}>
          <DayHeader days={days} today={today} />

          {/* Weekend shading and the today line sit under everything else. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-0"
            style={{ top: HEADER_HEIGHT }}
            width={width}
            height={height}
          >
            <defs>
              <marker
                id="timeline-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0L8 4L0 8z" fill="var(--border-strong)" />
              </marker>
              <marker
                id="timeline-arrow-conflict"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0L8 4L0 8z" fill="var(--danger)" />
              </marker>
            </defs>
            {days.map((day, index) =>
              weekdayIndex(day) >= 5 ? (
                <rect
                  key={day}
                  x={index * DAY_WIDTH}
                  y={0}
                  width={DAY_WIDTH}
                  height={height}
                  fill="var(--surface-sunken)"
                />
              ) : null
            )}
            {todayIndex >= 0 && todayIndex < layout.days && (
              <line
                x1={todayIndex * DAY_WIDTH + DAY_WIDTH / 2}
                x2={todayIndex * DAY_WIDTH + DAY_WIDTH / 2}
                y1={0}
                y2={height}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            )}
            {layout.arrows.map((arrow) => {
              const from = layout.rows[arrow.fromRow]!;
              const to = layout.rows[arrow.toRow]!;
              const x1 = (from.end + 1) * DAY_WIDTH - 2;
              const y1 = arrow.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
              const x2 = to.start * DAY_WIDTH + 2;
              const y2 = arrow.toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
              const elbow = x1 + 8;
              return (
                <path
                  key={`${from.task.id}-${to.task.id}`}
                  d={`M${x1} ${y1} H${elbow} V${y2} H${x2}`}
                  fill="none"
                  stroke={arrow.conflict ? "var(--danger)" : "var(--border-strong)"}
                  strokeWidth={arrow.conflict ? 2 : 1.5}
                  markerEnd={`url(#${arrow.conflict ? "timeline-arrow-conflict" : "timeline-arrow"})`}
                />
              );
            })}
          </svg>

          {layout.rows.map((row, index) => {
            const overdue = isOverdue(row.task);
            const done = row.task.status === "completed";
            return (
              <button
                key={row.task.id}
                type="button"
                onClick={() => dispatch(inspectTask(row.task.id))}
                aria-label={`${row.task.title}. ${PRIORITY_LABELS[row.task.priority]} priority, ${
                  STATUS_LABELS[row.task.status]
                }, due ${formatDate(row.task.dueDate)}.`}
                title={`${row.task.title} — due ${formatDate(row.task.dueDate)}`}
                className={cx(
                  "absolute rounded-[5px] border text-left transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2",
                  overdue ? "border-[var(--danger)]" : "border-transparent",
                  done && "opacity-45"
                )}
                style={{
                  left: row.start * DAY_WIDTH + 2,
                  width: (row.end - row.start + 1) * DAY_WIDTH - 4,
                  top: HEADER_HEIGHT + index * ROW_HEIGHT + 8,
                  height: ROW_HEIGHT - 16,
                  backgroundColor: `color-mix(in oklch, var(--priority-${row.task.priority}) 70%, transparent)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayHeader({ days, today }: { days: string[]; today: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute left-0 top-0 flex border-b border-[var(--border-subtle)]"
      style={{ height: HEADER_HEIGHT }}
    >
      {days.map((day, index) => {
        const date = parseDay(day);
        const firstOfMonth = date.getUTCDate() === 1 || index === 0;
        return (
          <div
            key={day}
            className="relative flex flex-col items-center justify-end pb-1"
            style={{ width: DAY_WIDTH }}
          >
            {firstOfMonth && (
              <span className="absolute left-1 top-1 whitespace-nowrap text-2xs font-semibold text-[var(--text-secondary)]">
                {date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}
              </span>
            )}
            <span
              className={cx(
                "flex h-5 w-5 items-center justify-center rounded-full text-2xs tabular-nums",
                day === today
                  ? "bg-[var(--accent)] font-semibold text-white"
                  : "text-[var(--text-muted)]"
              )}
            >
              {date.getUTCDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
