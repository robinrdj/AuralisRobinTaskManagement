import { useMemo, useState } from "react";
import { formatDate, isOverdue, todayISO, type Task } from "@auralis/shared";
import { useAppDispatch } from "@/store";
import { inspectTask } from "@/store/uiSlice";
import { Button, Skeleton } from "@/components/ui/primitives";
import { cx, PRIORITY_LABELS, STATUS_LABELS } from "@/components/ui/labels";
import { groupByDueDate, monthGrid, monthOf, shiftMonth, type MonthKey } from "./calendar";
import { parseDay } from "./dates";
import { ScheduleShell, type ScheduleData } from "./ScheduleShell";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Chips a day cell shows before collapsing the rest into "+N more". */
const CHIPS_PER_DAY = 3;
const DRAG_TYPE = "application/x-task-id";

/**
 * Tasks laid out by due date on a month grid.
 *
 * Dragging a task to another day reschedules it, with the usual undo toast.
 * Choosing a day lists everything due on it below the grid — which is also
 * how the calendar works on a phone, where cells are too small for titles.
 */
export function CalendarPage({ boardId, readOnly }: { boardId: string; readOnly: boolean }) {
  return (
    <ScheduleShell boardId={boardId} readOnly={readOnly} title="Calendar">
      {(data) => <Calendar data={data} readOnly={readOnly} />}
    </ScheduleShell>
  );
}

function Calendar({ data, readOnly }: { data: ScheduleData; readOnly: boolean }) {
  const dispatch = useAppDispatch();
  const today = todayISO();
  const [month, setMonth] = useState<MonthKey>(monthOf(today));
  const [selected, setSelected] = useState<string>(today);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const days = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => groupByDueDate(data.visible), [data.visible]);
  const undated = data.visible.filter((task) => !task.dueDate && task.status !== "completed");
  const selectedTasks = byDay.get(selected) ?? [];

  const monthLabel = parseDay(`${month}-01`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const reschedule = (taskId: string, day: string) => {
    const task = data.tasks.find((candidate) => candidate.id === taskId);
    if (!task || task.dueDate === day) return;
    void data.actions.update(
      task,
      { dueDate: day },
      `Moved "${task.title.length > 28 ? `${task.title.slice(0, 27)}…` : task.title}" to ${formatDate(day)}`
    );
  };

  if (data.isLoading) return <Skeleton className="h-[28rem] w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className="mr-auto text-lg font-semibold text-[var(--text-primary)]"
          aria-live="polite"
        >
          {monthLabel}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Previous month"
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
        >
          ‹
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setMonth(monthOf(today));
            setSelected(today);
          }}
        >
          Today
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Next month"
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
        >
          ›
        </Button>
      </div>

      <div
        className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-base)]"
        role="grid"
        aria-label={`Tasks due in ${monthLabel}`}
      >
        <div role="row" className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              role="columnheader"
              className="px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            >
              {weekday}
            </div>
          ))}
        </div>

        {Array.from({ length: days.length / 7 }, (_, week) => (
          <div key={week} role="row" className="grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const tasks = byDay.get(day) ?? [];
              const inMonth = monthOf(day) === month;
              const isToday = day === today;
              const isSelected = day === selected;
              const label = parseDay(day).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              });

              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-selected={isSelected}
                  data-day={day}
                  onDragOver={(event) => {
                    if (readOnly || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
                    event.preventDefault();
                    setDropTarget(day);
                  }}
                  onDragLeave={() =>
                    setDropTarget((current) => (current === day ? null : current))
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    setDropTarget(null);
                    const id = event.dataTransfer.getData(DRAG_TYPE);
                    if (id) reschedule(id, day);
                  }}
                  className={cx(
                    "min-h-[4.5rem] border-b border-r border-[var(--border-subtle)] p-1 sm:min-h-[7rem] [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-[var(--surface-sunken)]",
                    isSelected && "bg-[var(--accent-subtle)]",
                    dropTarget === day && "ring-2 ring-inset ring-[var(--accent)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(day)}
                    aria-label={`${label}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} due`}
                    aria-pressed={isSelected}
                    className={cx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday
                        ? "bg-[var(--accent)] font-semibold text-white"
                        : inMonth
                          ? "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>

                  {/* Phones: a count, since titles cannot fit. */}
                  {tasks.length > 0 && (
                    <span
                      aria-hidden="true"
                      className="mt-1 flex items-center gap-0.5 sm:hidden"
                    >
                      {tasks.slice(0, 4).map((task) => (
                        <span
                          key={task.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: `var(--priority-${task.priority})` }}
                        />
                      ))}
                    </span>
                  )}

                  <ul className="mt-1 hidden flex-col gap-0.5 sm:flex">
                    {tasks.slice(0, CHIPS_PER_DAY).map((task) => (
                      <li key={task.id}>
                        <TaskChip task={task} draggable={!readOnly} />
                      </li>
                    ))}
                    {tasks.length > CHIPS_PER_DAY && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setSelected(day)}
                          className="px-1 text-2xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          +{tasks.length - CHIPS_PER_DAY} more
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-label="Tasks due on the selected day">
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
          {parseDay(selected).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </h3>
        {selectedTasks.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nothing due.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {selectedTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => dispatch(inspectTask(task.id))}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
                  style={{ borderLeft: `3px solid var(--priority-${task.priority})` }}
                >
                  <span
                    className={cx(
                      "min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]",
                      task.status === "completed" && "text-[var(--text-muted)] line-through"
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="shrink-0 text-2xs text-[var(--text-muted)]">
                    {PRIORITY_LABELS[task.priority]} · {STATUS_LABELS[task.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {undated.length > 0 && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {undated.length} open {undated.length === 1 ? "task has" : "tasks have"} no due date
            and {undated.length === 1 ? "isn't" : "aren't"} on the calendar.
          </p>
        )}
      </section>
    </div>
  );
}

function TaskChip({ task, draggable }: { task: Task; draggable: boolean }) {
  const dispatch = useAppDispatch();
  const overdue = isOverdue(task);
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => dispatch(inspectTask(task.id))}
      title={task.title}
      className={cx(
        "w-full truncate rounded px-1.5 py-0.5 text-left text-2xs font-medium",
        draggable && "cursor-grab active:cursor-grabbing",
        task.status === "completed"
          ? "text-[var(--text-muted)] line-through"
          : overdue
            ? "text-[var(--danger)]"
            : "text-[var(--text-primary)]"
      )}
      style={{
        backgroundColor: `color-mix(in oklch, var(--priority-${task.priority}) 16%, transparent)`,
      }}
    >
      {task.title}
    </button>
  );
}
