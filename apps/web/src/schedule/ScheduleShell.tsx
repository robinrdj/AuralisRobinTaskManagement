import { useMemo, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import type { Task } from "@auralis/shared";
import { useAppDispatch, useAppSelector } from "@/store";
import { useGetBoardMembersQuery, useGetLabelsQuery, useGetTasksQuery } from "@/store/api";
import { clearFilters, hasActiveFilters, inspectTask } from "@/store/uiSlice";
import { useTaskActions } from "@/hooks/useTaskActions";
import { useRealtimeBoard } from "@/hooks/useRealtimeBoard";
import { groupSubtasks, matchesFilters } from "@/board/boardData";
import { groupLabels, TaskLabelsContext } from "@/board/boardContext";
import { TaskDetailPanel } from "@/board/TaskDetailPanel";
import { Button } from "@/components/ui/primitives";

export interface ScheduleData {
  /** Every task on the board, subtasks included. */
  tasks: Task[];
  /** The tasks the board's current filters let through. */
  visible: Task[];
  isLoading: boolean;
  actions: ReturnType<typeof useTaskActions>;
}

/**
 * What the calendar and timeline share with the board: the same tasks, the
 * same filters (so a saved view narrows every view alike), live updates, and
 * the same detail panel when a task is opened.
 */
export function ScheduleShell({
  boardId,
  readOnly,
  title,
  children,
}: {
  boardId: string;
  readOnly: boolean;
  title: string;
  children: (data: ScheduleData) => ReactNode;
}) {
  const dispatch = useAppDispatch();
  const { data: tasks = [], isLoading } = useGetTasksQuery(boardId);
  const { data: memberData } = useGetBoardMembersQuery(boardId);
  const { data: labelData } = useGetLabelsQuery(boardId);
  const actions = useTaskActions(boardId);
  const filters = useAppSelector((state) => state.ui.filters);
  const inspectedTaskId = useAppSelector((state) => state.ui.inspectedTaskId);
  useRealtimeBoard(boardId);

  const boardLabels = useMemo(() => labelData?.labels ?? [], [labelData]);
  const labelsByTask = useMemo(
    () => groupLabels(boardLabels, labelData?.assignments ?? []),
    [boardLabels, labelData]
  );
  const visible = useMemo(() => {
    const now = new Date();
    return tasks.filter((task) => matchesFilters(task, filters, now, labelsByTask));
  }, [tasks, filters, labelsByTask]);
  const subtasksByParent = useMemo(() => groupSubtasks(tasks), [tasks]);
  const inspected = inspectedTaskId
    ? (tasks.find((task) => task.id === inspectedTaskId) ?? null)
    : null;
  const filtered = hasActiveFilters(filters);

  return (
    <TaskLabelsContext.Provider value={labelsByTask}>
      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-4 md:px-6">
        <h1 className="sr-only">{title}</h1>
        {filtered && (
          <p className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            The board's filters apply here too, so some tasks are hidden.
            <Button size="sm" variant="ghost" onClick={() => dispatch(clearFilters())}>
              Show everything
            </Button>
          </p>
        )}
        {children({ tasks, visible, isLoading, actions })}
      </div>

      <AnimatePresence>
        {inspected && (
          <TaskDetailPanel
            key={inspected.id}
            task={inspected}
            subtasks={subtasksByParent.get(inspected.id) ?? []}
            siblings={tasks.filter((entry) => !entry.parentId)}
            members={memberData?.members ?? []}
            labels={boardLabels}
            actions={actions}
            readOnly={readOnly}
            onClose={() => dispatch(inspectTask(null))}
          />
        )}
      </AnimatePresence>
    </TaskLabelsContext.Provider>
  );
}
