import { useEffect, useState } from "react";
import { entrySeconds, formatDuration, todayISO, type Task } from "@auralis/shared";
import {
  useAddTimeMutation,
  useDeleteTimeMutation,
  useGetRunningTimerQuery,
  useGetTaskTimeQuery,
  useStartTimerMutation,
  useStopTimerMutation,
} from "@/store/api";
import { useAppDispatch } from "@/store";
import { pushToast } from "@/store/toastSlice";
import { Button } from "@/components/ui/primitives";
import { cx, errorMessage } from "@/components/ui/labels";
import type { useTaskActions } from "@/hooks/useTaskActions";
import { useTick } from "@/hooks/useTick";

/**
 * The time section of the task panel: an estimate, a start/stop timer, time
 * added by hand, and the log of who spent how long.
 */
export function TimeTracking({
  task,
  currentUserId,
  isOwner,
  readOnly,
  actions,
}: {
  task: Task;
  currentUserId: string | undefined;
  isOwner: boolean;
  readOnly: boolean;
  actions: ReturnType<typeof useTaskActions>;
}) {
  const dispatch = useAppDispatch();
  const { data: entries = [] } = useGetTaskTimeQuery(task.id);
  const { data: running } = useGetRunningTimerQuery();
  const [startTimer, { isLoading: starting }] = useStartTimerMutation();
  const [stopTimer, { isLoading: stopping }] = useStopTimerMutation();
  const [addTime, { isLoading: adding }] = useAddTimeMutation();
  const [deleteTime] = useDeleteTimeMutation();

  const mineRunningHere = running?.taskId === task.id;
  const anyRunningHere = entries.some((entry) => entry.endedAt === null);
  const now = useTick(anyRunningHere);

  const tracked = entries.reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
  const estimate = task.estimateMinutes ? task.estimateMinutes * 60 : null;
  const share = estimate ? tracked / estimate : null;

  const [estimateDraft, setEstimateDraft] = useState(
    task.estimateMinutes ? String(+(task.estimateMinutes / 60).toFixed(2)) : ""
  );
  useEffect(() => {
    setEstimateDraft(
      task.estimateMinutes ? String(+(task.estimateMinutes / 60).toFixed(2)) : ""
    );
  }, [task.estimateMinutes]);

  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDate, setManualDate] = useState(todayISO());

  const report = (error: unknown, fallback: string) =>
    dispatch(pushToast({ message: errorMessage(error, fallback), tone: "danger" }));

  const saveEstimate = () => {
    const hours = Number.parseFloat(estimateDraft);
    const minutes = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
    if (minutes === (task.estimateMinutes ?? null)) return;
    void actions.update(
      task,
      { estimateMinutes: minutes },
      minutes ? `Estimated ${formatDuration(minutes * 60)}` : "Removed the estimate"
    );
  };

  return (
    <section aria-label="Time">
      <h3 className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Time
        <span className="tabular-nums normal-case tracking-normal">
          {formatDuration(tracked)} tracked
          {estimate !== null && ` of ${formatDuration(estimate)}`}
        </span>
      </h3>

      {share !== null && (
        <div
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]"
          role="meter"
          aria-label="Tracked time against the estimate"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div
            className={cx(
              "h-full rounded-full",
              share > 1 ? "bg-[var(--danger)]" : "bg-[var(--accent)]"
            )}
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
      )}

      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          {mineRunningHere ? (
            <Button
              size="sm"
              variant="danger"
              disabled={stopping}
              onClick={() =>
                void stopTimer()
                  .unwrap()
                  .catch((error) => report(error, "Could not stop the timer."))
              }
            >
              Stop timer
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              disabled={starting}
              title={running ? `This stops the timer on "${running.taskTitle}"` : undefined}
              onClick={() =>
                void startTimer({ taskId: task.id })
                  .unwrap()
                  .catch((error) => report(error, "Could not start the timer."))
              }
            >
              Start timer
            </Button>
          )}

          <label className="ml-auto flex flex-col gap-1 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Estimate (hours)
            <input
              type="number"
              min={0}
              step={0.25}
              inputMode="decimal"
              value={estimateDraft}
              onChange={(event) => setEstimateDraft(event.target.value)}
              onBlur={saveEstimate}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              }}
              placeholder="None"
              className="h-7 w-24 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-xs font-normal normal-case tracking-normal text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
        </div>
      )}

      {!readOnly && (
        <form
          className="mb-3 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const minutes = Number.parseInt(manualMinutes, 10);
            if (!Number.isFinite(minutes) || minutes < 1) return;
            void addTime({ taskId: task.id, minutes, date: manualDate })
              .unwrap()
              .then(() => setManualMinutes(""))
              .catch((error) => report(error, "Could not add that time."));
          }}
        >
          <input
            type="number"
            min={1}
            max={1440}
            value={manualMinutes}
            onChange={(event) => setManualMinutes(event.target.value)}
            placeholder="Minutes"
            aria-label="Minutes to add"
            className="h-7 w-24 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <input
            type="date"
            value={manualDate}
            max={todayISO()}
            onChange={(event) => setManualDate(event.target.value || todayISO())}
            aria-label="Day the time was spent"
            className="h-7 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={adding || !manualMinutes}>
            Log time
          </Button>
        </form>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Time entries">
          {entries.slice(0, 8).map((entry) => {
            const canDelete = !readOnly && (entry.userId === currentUserId || isOwner);
            return (
              <li key={entry.id} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 tabular-nums font-medium text-[var(--text-primary)]">
                  {entry.endedAt ? formatDuration(entrySeconds(entry, now)) : "Running"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
                  {entry.userName ?? "Former member"} ·{" "}
                  {new Date(entry.startedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                  {entry.note && ` · ${entry.note}`}
                </span>
                {canDelete && entry.endedAt && (
                  <button
                    type="button"
                    aria-label={`Remove ${formatDuration(entrySeconds(entry, now))} by ${entry.userName ?? "a former member"}`}
                    onClick={() =>
                      void deleteTime({ taskId: task.id, entryId: entry.id })
                        .unwrap()
                        .catch((error) => report(error, "Could not remove that entry."))
                    }
                    className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
          {entries.length > 8 && (
            <li className="text-2xs text-[var(--text-muted)]">
              and {entries.length - 8} earlier {entries.length - 8 === 1 ? "entry" : "entries"}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
