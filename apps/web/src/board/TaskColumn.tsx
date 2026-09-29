import { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Task, TaskStatus } from "@auralis/shared";
import { TaskCard } from "./TaskCard";
import { cx, STATUS_LABELS } from "@/components/ui/labels";

export interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  totalCount: number;
  selectedIds: Set<string>;
  selectionMode: boolean;
  subtasksByParent: Map<string, Task[]>;
  membersById: Map<string, { name: string; color: string }>;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  /** Omitted on a read-only board, which hides the add button. */
  onAddTask?: (status: TaskStatus) => void;
}

/**
 * Above this many cards the column switches to virtualised rendering.
 *
 * v1 documented virtualisation as "considered but omitted due to integration
 * issues with drag-and-drop" — the old library needed every draggable mounted.
 * dnd-kit tracks items by id rather than by mounted node, so only the visible
 * window needs to exist. Below the threshold the plain list is cheaper and
 * keeps drag-scrolling perfectly smooth.
 */
const VIRTUALIZE_ABOVE = 40;

export function TaskColumn({
  status,
  tasks,
  totalCount,
  selectedIds,
  selectionMode,
  subtasksByParent,
  membersById,
  onToggleSelect,
  onOpen,
  onAddTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = tasks.length > VIRTUALIZE_ABOVE;
  const ids = tasks.map((task) => task.id);
  const filtered = totalCount > tasks.length;

  return (
    <section
      className="flex min-h-0 w-full flex-col rounded-[var(--radius-card)] bg-[var(--surface-base)] md:w-[19rem] md:shrink-0"
      aria-label={`${STATUS_LABELS[status]} column, ${tasks.length} tasks`}
      data-tour={`column-${status}`}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: `var(--status-${status})` }}
        />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {STATUS_LABELS[status]}
        </h2>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">
          {filtered ? `${tasks.length} of ${totalCount}` : tasks.length}
        </span>

        {onAddTask && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            aria-label={`Add a task to ${STATUS_LABELS[status]}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </header>

      {/* A subtle progress bar of how much of this column is done. */}
      <div className="mx-3 mb-2 h-0.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: totalCount === 0 ? "0%" : `${(tasks.length / totalCount) * 100}%`,
            backgroundColor: `var(--status-${status})`,
          }}
        />
      </div>

      <div
        ref={setNodeRef}
        className={cx(
          "min-h-0 flex-1 rounded-b-[var(--radius-card)] transition-colors duration-150",
          isOver && "bg-[var(--accent-subtle)]"
        )}
      >
        <div
          ref={scrollRef}
          className="scrollbar-slim h-full max-h-[calc(100vh-16rem)] overflow-y-auto px-3 pb-3"
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {tasks.length === 0 ? (
              <EmptyColumn status={status} isOver={isOver} />
            ) : shouldVirtualize ? (
              <VirtualisedList
                tasks={tasks}
                scrollRef={scrollRef}
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                subtasksByParent={subtasksByParent}
                membersById={membersById}
                onToggleSelect={onToggleSelect}
                onOpen={onOpen}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      selected={selectedIds.has(task.id)}
                      selectionMode={selectionMode}
                      subtaskCount={subtasksByParent.get(task.id)?.length ?? 0}
                      completedSubtasks={
                        subtasksByParent
                          .get(task.id)
                          ?.filter((child) => child.status === "completed").length ?? 0
                      }
                      assigneeName={
                        task.assigneeId ? membersById.get(task.assigneeId)?.name : undefined
                      }
                      assigneeColor={
                        task.assigneeId ? membersById.get(task.assigneeId)?.color : undefined
                      }
                      onToggleSelect={onToggleSelect}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SortableContext>
        </div>
      </div>
    </section>
  );
}

function VirtualisedList({
  tasks,
  scrollRef,
  selectedIds,
  selectionMode,
  subtasksByParent,
  membersById,
  onToggleSelect,
  onOpen,
}: {
  tasks: Task[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedIds: Set<string>;
  selectionMode: boolean;
  subtasksByParent: Map<string, Task[]>;
  membersById: Map<string, { name: string; color: string }>;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    // Cards vary in height with description and badges, so this is a starting
    // estimate that `measureElement` corrects once each row is laid out.
    estimateSize: () => 96,
    overscan: 6,
    getItemKey: (index) => tasks[index]!.id,
  });

  return (
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((row) => {
        const task = tasks[row.index]!;
        return (
          <div
            key={task.id}
            ref={virtualizer.measureElement}
            data-index={row.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start}px)`,
              paddingBottom: 8,
            }}
          >
            <TaskCard
              task={task}
              selected={selectedIds.has(task.id)}
              selectionMode={selectionMode}
              subtaskCount={subtasksByParent.get(task.id)?.length ?? 0}
              completedSubtasks={
                subtasksByParent.get(task.id)?.filter((child) => child.status === "completed")
                  .length ?? 0
              }
              assigneeName={
                task.assigneeId ? membersById.get(task.assigneeId)?.name : undefined
              }
              assigneeColor={
                task.assigneeId ? membersById.get(task.assigneeId)?.color : undefined
              }
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
            />
          </div>
        );
      })}
    </div>
  );
}

function EmptyColumn({ status, isOver }: { status: TaskStatus; isOver: boolean }) {
  return (
    <div
      className={cx(
        "flex h-24 items-center justify-center rounded-[var(--radius-control)] border border-dashed px-3 text-center text-xs transition-colors",
        isOver
          ? "border-[var(--accent)] text-[var(--accent-text)]"
          : "border-[var(--border-default)] text-[var(--text-muted)]"
      )}
    >
      {isOver ? "Drop it here" : `Nothing in ${STATUS_LABELS[status].toLowerCase()}`}
    </div>
  );
}
