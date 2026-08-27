import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import type { Task, TaskStatus } from "@auralis/shared";
import { useAppDispatch, useAppSelector } from "@/store";
import { useGetBoardMembersQuery, useGetTasksQuery } from "@/store/api";
import { clearSelection, inspectTask, toggleSelection } from "@/store/uiSlice";
import { useTaskActions } from "@/hooks/useTaskActions";
import { useRealtimeBoard } from "@/hooks/useRealtimeBoard";
import { buildBoard, groupSubtasks } from "./boardData";
import { resolveDropPosition, resolveDropTarget } from "./dropPosition";
import { TaskColumn } from "./TaskColumn";
import { TaskCard } from "./TaskCard";
import { FilterBar } from "./FilterBar";
import { SelectionBar } from "./SelectionBar";
import { TaskComposer } from "./TaskComposer";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { AuriGuide } from "@/tour/AuriGuide";
import { buildSampleTasks, SAMPLE_TASK_COUNT } from "./sampleTasks";

export function BoardPage({ boardId }: { boardId: string }) {
  const dispatch = useAppDispatch();
  const { data: tasks = [], isLoading } = useGetTasksQuery(boardId);
  const { data: memberData } = useGetBoardMembersQuery(boardId);
  const { connected, members: present } = useRealtimeBoard(boardId);
  const actions = useTaskActions(boardId);

  const { filters, sortBy, sortDirection, selectedIds, selectionMode, inspectedTaskId } =
    useAppSelector((state) => state.ui);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [composerStatus, setComposerStatus] = useState<TaskStatus | null>(null);

  // The command palette can ask for the composer from any route. The counter
  // changes on every request, so two requests in a row both register.
  const composeRequest = useAppSelector((state) => state.ui.composeRequest);
  useEffect(() => {
    if (composeRequest > 0) setComposerStatus("todo");
  }, [composeRequest]);

  const columns = useMemo(
    () => buildBoard({ tasks, filters, sortBy, sortDirection }),
    [tasks, filters, sortBy, sortDirection]
  );
  const subtasksByParent = useMemo(() => groupSubtasks(tasks), [tasks]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const membersById = useMemo(
    () =>
      new Map(
        (memberData?.members ?? []).map((member) => [
          member.userId,
          { name: member.name, color: member.color },
        ])
      ),
    [memberData]
  );

  /*
   * A pointer must travel 6px before a drag begins, so a click on a card opens
   * it rather than starting an accidental drag. The keyboard sensor gives the
   * same reordering to anyone not using a mouse.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    setDraggingTask(task ?? null);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = draggingTask;
      setDraggingTask(null);
      if (!active || !event.over) return;

      const target = resolveDropTarget(active, String(event.over.id), columns);
      if (!target) return;

      const destination = columns.find((column) => column.status === target.status);
      if (!destination) return;

      const withoutActive = destination.tasks.filter((task) => task.id !== active.id);
      const position = resolveDropPosition(withoutActive, target.index);

      // Nothing actually changed — skip the write rather than churn the log.
      if (active.status === target.status && active.position === position) return;

      void actions.move(active, target.status, position);
    },
    [draggingTask, columns, actions]
  );

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedSet.has(task.id)),
    [tasks, selectedSet]
  );

  /*
   * Resolved from the task list rather than held in state, so the open panel
   * reflects realtime edits and optimistic updates as they land — and closes
   * itself if the task is deleted from another client.
   */
  const inspectedTask = useMemo(
    () =>
      inspectedTaskId ? (tasks.find((task) => task.id === inspectedTaskId) ?? null) : null,
    [tasks, inspectedTaskId]
  );

  const seedSamples = useCallback(async () => {
    await actions.createMany(buildSampleTasks(), `Added ${SAMPLE_TASK_COUNT} sample tasks`);
  }, [actions]);

  if (isLoading) return <BoardSkeleton />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar
        boardId={boardId}
        members={memberData?.members ?? []}
        connected={connected}
        presentMembers={present}
        onAddTask={() => setComposerStatus("todo")}
      />

      <AnimatePresence>
        {selectionMode && selectedTasks.length > 0 && (
          <SelectionBar
            selected={selectedTasks}
            onClear={() => dispatch(clearSelection())}
            onUpdate={(updates) => void actions.updateMany(selectedTasks, updates)}
            onDelete={() => {
              void actions.removeMany(selectedTasks);
              dispatch(clearSelection());
            }}
          />
        )}
      </AnimatePresence>

      {tasks.length === 0 ? (
        <EmptyState
          title="Your board is empty"
          description="Add a task, or let Auri fill the board with a sample project so you can look around."
          action={
            <div className="mt-1 flex gap-2">
              <Button variant="primary" onClick={() => setComposerStatus("todo")}>
                Add a task
              </Button>
              <Button onClick={() => void seedSamples()}>Use sample data</Button>
            </div>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDraggingTask(null)}
        >
          <div className="scrollbar-slim flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 md:px-6">
            {columns.map((column) => (
              <TaskColumn
                key={column.status}
                status={column.status}
                tasks={column.tasks}
                totalCount={column.totalCount}
                selectedIds={selectedSet}
                selectionMode={selectionMode}
                subtasksByParent={subtasksByParent}
                membersById={membersById}
                onToggleSelect={(id) => dispatch(toggleSelection(id))}
                onOpen={(id) => dispatch(inspectTask(id))}
                onAddTask={setComposerStatus}
              />
            ))}
          </div>

          {/*
            The overlay renders the dragged card at the cursor in a portal, so
            it is never clipped by a column's own overflow.
          */}
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.25,1,0.5,1)" }}>
            {draggingTask && <TaskCard task={draggingTask} isOverlay />}
          </DragOverlay>
        </DndContext>
      )}

      <AnimatePresence>
        {composerStatus && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TaskComposer
              initialStatus={composerStatus}
              members={memberData?.members ?? []}
              onClose={() => setComposerStatus(null)}
              onCreate={async (input) => {
                await actions.create(input);
                setComposerStatus(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {inspectedTask && (
          <TaskDetailPanel
            key={inspectedTask.id}
            task={inspectedTask}
            subtasks={subtasksByParent.get(inspectedTask.id) ?? []}
            members={memberData?.members ?? []}
            actions={actions}
            onClose={() => dispatch(inspectTask(null))}
          />
        )}
      </AnimatePresence>

      <AuriGuide tasks={tasks} onSeedSamples={() => void seedSamples()} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 px-4 pt-4 md:px-6" aria-busy="true" aria-label="Loading board">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="w-full md:w-[19rem] md:shrink-0">
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 - column }).map((_, card) => (
              <Skeleton key={card} className="h-[88px] w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
