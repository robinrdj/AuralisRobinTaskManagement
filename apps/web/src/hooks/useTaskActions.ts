import { useCallback } from "react";
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from "@auralis/shared";
import {
  useBulkCreateTasksMutation,
  useBulkDeleteTasksMutation,
  useBulkUpdateTasksMutation,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
} from "@/store/api";
import { useAppDispatch } from "@/store";
import { pushToast, registerUndo } from "@/store/toastSlice";
import { recordMove } from "@/store/tourSlice";

/**
 * Every mutation, wrapped so it reports itself and can be taken back.
 *
 * The pattern throughout: apply the change immediately (RTK Query handles the
 * optimistic cache write and rollback), then raise a toast carrying a
 * compensating action. Undo is a real write, not a deferred delete — v1 held
 * deletions for five seconds before committing, which left the board showing
 * a task that was neither present nor gone.
 *
 * Recreating a deleted task reuses its original id, so anything referencing it
 * still resolves and the card returns to the same place rather than to the end
 * of the column.
 */
export function useTaskActions(boardId: string | undefined) {
  const dispatch = useAppDispatch();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [bulkUpdate] = useBulkUpdateTasksMutation();
  const [bulkDelete] = useBulkDeleteTasksMutation();
  const [bulkCreate] = useBulkCreateTasksMutation();

  const notifyFailure = useCallback(
    (message: string) => {
      dispatch(pushToast({ message, tone: "danger" }));
    },
    [dispatch]
  );

  const create = useCallback(
    async (input: CreateTaskInput) => {
      if (!boardId) return;
      const id = input.id ?? crypto.randomUUID();
      try {
        await createTask({ ...input, id, boardId }).unwrap();
        dispatch(
          pushToast({
            message: `Added "${truncate(input.title)}"`,
            tone: "success",
            undoToken: registerUndo(async () => {
              await deleteTask({ id, boardId }).unwrap();
            }),
          })
        );
      } catch {
        notifyFailure("Could not add that task. Nothing was saved.");
      }
    },
    [boardId, createTask, deleteTask, dispatch, notifyFailure]
  );

  /**
   * Creates many tasks as one user-visible action.
   *
   * Seeding the sample board this way rather than by calling `create` in a
   * loop matters twice over: the requests go out together instead of in a
   * twelve-deep serial chain, and the user gets one toast with one undo
   * instead of twelve of each.
   */
  const createMany = useCallback(
    async (inputs: CreateTaskInput[], description: string) => {
      if (!boardId || inputs.length === 0) return;
      const withIds = inputs.map((input) => ({
        ...input,
        id: input.id ?? crypto.randomUUID(),
      }));

      try {
        await Promise.all(withIds.map((input) => createTask({ ...input, boardId }).unwrap()));
        dispatch(
          pushToast({
            message: description,
            tone: "success",
            undoToken: registerUndo(async () => {
              await bulkDelete({ ids: withIds.map((input) => input.id!), boardId }).unwrap();
            }),
          })
        );
      } catch {
        notifyFailure("Could not add those tasks.");
      }
    },
    [boardId, createTask, bulkDelete, dispatch, notifyFailure]
  );

  /**
   * Writes an imported file in one request.
   *
   * Separate from `createMany` because import can be hundreds of rows: the
   * server assigns positions for the whole batch in a single transaction, and
   * undo removes exactly what was added rather than emptying the board.
   */
  const importTasks = useCallback(
    async (inputs: CreateTaskInput[]) => {
      if (!boardId || inputs.length === 0) return;
      try {
        const created = await bulkCreate({ boardId, tasks: inputs }).unwrap();
        dispatch(
          pushToast({
            message: `Imported ${created.length} ${created.length === 1 ? "task" : "tasks"}`,
            tone: "success",
            undoToken: registerUndo(async () => {
              await bulkDelete({ ids: created.map((task) => task.id), boardId }).unwrap();
            }),
          })
        );
      } catch {
        notifyFailure("Could not import those tasks. Nothing was added.");
      }
    },
    [boardId, bulkCreate, bulkDelete, dispatch, notifyFailure]
  );

  const update = useCallback(
    async (task: Task, updates: UpdateTaskInput, description?: string) => {
      if (!boardId) return;

      // Capture only the fields being changed, so undo restores exactly those
      // and does not clobber a concurrent edit to an unrelated field.
      const previous: UpdateTaskInput = {};
      for (const key of Object.keys(updates) as (keyof UpdateTaskInput)[]) {
        (previous as Record<string, unknown>)[key] = (task as Record<string, unknown>)[key];
      }

      try {
        await updateTask({ id: task.id, boardId, updates }).unwrap();
        if (updates.status) dispatch(recordMove(updates.status));
        dispatch(
          pushToast({
            message: description ?? `Updated "${truncate(task.title)}"`,
            tone: "success",
            undoToken: registerUndo(async () => {
              await updateTask({ id: task.id, boardId, updates: previous }).unwrap();
            }),
          })
        );
      } catch {
        notifyFailure("Could not save that change.");
      }
    },
    [boardId, updateTask, dispatch, notifyFailure]
  );

  /** A drag is an update, but too frequent to deserve a toast each time. */
  const move = useCallback(
    async (task: Task, status: TaskStatus, position: string) => {
      if (!boardId) return;
      try {
        await updateTask({ id: task.id, boardId, updates: { status, position } }).unwrap();
        dispatch(recordMove(status));
      } catch {
        notifyFailure("Could not move that task.");
      }
    },
    [boardId, updateTask, dispatch, notifyFailure]
  );

  const remove = useCallback(
    async (task: Task) => {
      if (!boardId) return;
      try {
        await deleteTask({ id: task.id, boardId }).unwrap();
        dispatch(
          pushToast({
            message: `Deleted "${truncate(task.title)}"`,
            tone: "info",
            undoToken: registerUndo(async () => {
              await createTask({
                boardId,
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                assigneeId: task.assigneeId,
                parentId: task.parentId,
                position: task.position,
              }).unwrap();
            }),
          })
        );
      } catch {
        notifyFailure("Could not delete that task.");
      }
    },
    [boardId, deleteTask, createTask, dispatch, notifyFailure]
  );

  const updateMany = useCallback(
    async (tasks: Task[], updates: UpdateTaskInput) => {
      if (!boardId || tasks.length === 0) return;
      const ids = tasks.map((task) => task.id);

      // Undo restores each task's own prior values, which a single bulk call
      // cannot express — so the compensating action is one call per distinct
      // previous value.
      const previousByTask = new Map<string, UpdateTaskInput>(
        tasks.map((task) => {
          const previous: UpdateTaskInput = {};
          for (const key of Object.keys(updates) as (keyof UpdateTaskInput)[]) {
            (previous as Record<string, unknown>)[key] = (task as Record<string, unknown>)[key];
          }
          return [task.id, previous];
        })
      );

      try {
        await bulkUpdate({ ids, boardId, updates }).unwrap();
        dispatch(
          pushToast({
            message: `Updated ${ids.length} ${ids.length === 1 ? "task" : "tasks"}`,
            tone: "success",
            undoToken: registerUndo(async () => {
              await Promise.all(
                [...previousByTask].map(([id, previous]) =>
                  updateTask({ id, boardId, updates: previous }).unwrap()
                )
              );
            }),
          })
        );
      } catch {
        notifyFailure("Could not update those tasks.");
      }
    },
    [boardId, bulkUpdate, updateTask, dispatch, notifyFailure]
  );

  const removeMany = useCallback(
    async (tasks: Task[]) => {
      if (!boardId || tasks.length === 0) return;
      const snapshot = tasks.map((task) => ({ ...task }));

      try {
        await bulkDelete({ ids: tasks.map((task) => task.id), boardId }).unwrap();
        dispatch(
          pushToast({
            message: `Deleted ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
            tone: "info",
            undoToken: registerUndo(async () => {
              // Sequential rather than parallel: parents must exist before the
              // subtasks that reference them.
              for (const task of snapshot.sort(byParentsFirst)) {
                await createTask({
                  boardId,
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  priority: task.priority,
                  dueDate: task.dueDate,
                  assigneeId: task.assigneeId,
                  parentId: task.parentId,
                  position: task.position,
                }).unwrap();
              }
            }),
          })
        );
      } catch {
        notifyFailure("Could not delete those tasks.");
      }
    },
    [boardId, bulkDelete, createTask, dispatch, notifyFailure]
  );

  return { create, createMany, importTasks, update, move, remove, updateMany, removeMany };
}

function byParentsFirst(a: Task, b: Task): number {
  if (a.parentId === null && b.parentId !== null) return -1;
  if (a.parentId !== null && b.parentId === null) return 1;
  return 0;
}

function truncate(title: string, max = 32): string {
  return title.length <= max ? title : `${title.slice(0, max - 1)}…`;
}
