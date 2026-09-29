import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDuration, type Task } from "@auralis/shared";
import { useGetBoardTimeQuery } from "@/store/api";
import { useAppDispatch } from "@/store";
import { inspectTask } from "@/store/uiSlice";
import { Card } from "@/components/ui/primitives";
import { cx } from "@/components/ui/labels";
import { estimateRows } from "./estimates";

/**
 * Where the time went: who tracked how much this week, and which tasks ran
 * over their estimates. Tables rather than charts — the numbers are the point.
 */
export function TimeReport({ boardId, tasks }: { boardId: string; tasks: Task[] }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data } = useGetBoardTimeQuery(boardId);

  const trackedByTask = useMemo(
    () => new Map((data?.byTask ?? []).map((row) => [row.taskId, row.seconds])),
    [data]
  );
  const rows = useMemo(() => estimateRows(tasks, trackedByTask), [tasks, trackedByTask]);
  const people = data?.byPerson ?? [];
  const weekTotal = people.reduce((sum, person) => sum + person.seconds, 0);

  if (!data || (rows.length === 0 && people.length === 0)) {
    return (
      <Card className="mt-4 p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Time</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          No time tracked yet. Start a timer or give a task an estimate from its details panel.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Time this week</h2>
        <p className="text-xs text-[var(--text-muted)]">
          {formatDuration(weekTotal)} across the board in the last 7 days
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="pb-1.5 font-semibold">Person</th>
              <th className="pb-1.5 text-right font-semibold">Tracked</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr
                key={person.userId ?? person.name}
                className="border-t border-[var(--border-subtle)]"
              >
                <td className="py-1.5 text-[var(--text-primary)]">{person.name}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                  {formatDuration(person.seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Estimates against actual
        </h2>
        <p className="text-xs text-[var(--text-muted)]">Furthest over its estimate first</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="text-left text-2xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="pb-1.5 font-semibold">Task</th>
                <th className="pb-1.5 text-right font-semibold">Estimate</th>
                <th className="pb-1.5 text-right font-semibold">Tracked</th>
                <th className="pb-1.5 text-right font-semibold">Used</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((row) => (
                <tr key={row.task.id} className="border-t border-[var(--border-subtle)]">
                  <td className="max-w-[14rem] truncate py-1.5">
                    <button
                      type="button"
                      className="truncate text-left text-[var(--text-primary)] hover:underline"
                      onClick={() => {
                        // Analytics has no task panel; the board does.
                        navigate("/board");
                        dispatch(inspectTask(row.task.id));
                      }}
                    >
                      {row.task.title}
                    </button>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {row.estimateSeconds === null ? "—" : formatDuration(row.estimateSeconds)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatDuration(row.trackedSeconds)}
                  </td>
                  <td
                    className={cx(
                      "py-1.5 text-right tabular-nums",
                      row.ratio !== null && row.ratio > 1
                        ? "font-medium text-[var(--danger)]"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    {row.ratio === null ? "—" : `${Math.round(row.ratio * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
