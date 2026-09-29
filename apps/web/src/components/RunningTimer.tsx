import { useNavigate } from "react-router-dom";
import { entrySeconds, formatClock } from "@auralis/shared";
import { useGetRunningTimerQuery, useStopTimerMutation } from "@/store/api";
import { useAppDispatch } from "@/store";
import { inspectTask, setActiveBoard } from "@/store/uiSlice";
import { useTick } from "@/hooks/useTick";

/**
 * The timer you have running, wherever you are in the app: its task, a live
 * clock, and a stop button. Nothing renders when no timer is running.
 */
export function RunningTimer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data: running } = useGetRunningTimerQuery(undefined, { pollingInterval: 60_000 });
  const [stopTimer, { isLoading }] = useStopTimerMutation();
  const now = useTick(Boolean(running));

  if (!running) return null;
  const clock = formatClock(entrySeconds(running, now));

  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--surface-raised)] py-0.5 pl-2.5 pr-1 text-xs">
      <span
        aria-hidden="true"
        className="h-2 w-2 animate-pulse rounded-full bg-[var(--danger)]"
      />
      <button
        type="button"
        onClick={() => {
          dispatch(setActiveBoard(running.boardId));
          navigate("/board");
          dispatch(inspectTask(running.taskId));
        }}
        title={running.taskTitle}
        aria-label={`Timer running on ${running.taskTitle}, ${clock}. Open the task`}
        className="flex min-w-0 items-center gap-1.5 hover:underline"
      >
        <span className="hidden max-w-[9rem] truncate text-[var(--text-secondary)] lg:inline">
          {running.taskTitle}
        </span>
        <span className="font-medium tabular-nums text-[var(--text-primary)]">{clock}</span>
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => void stopTimer()}
        aria-label="Stop the timer"
        className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
