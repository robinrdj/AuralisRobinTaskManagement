import { useEffect, useState } from "react";
import type { Task } from "@auralis/shared";
import { api, CLIENT_ID } from "@/store/api";
import { apiUrl } from "@/config";
import { useAppDispatch } from "@/store";

export interface PresenceMember {
  userId: string;
  name: string;
  color: string;
}

/**
 * Keeps the board in sync with everyone else looking at it.
 *
 * Updates arrive over server-sent events and are written straight into the
 * RTK Query cache, so no refetch is needed and the change lands in the same
 * place an optimistic update would. Messages tagged with this client's own id
 * are ignored: the local cache already reflects them, and re-applying would
 * undo any edit made in the meantime.
 *
 * EventSource reconnects by itself, but it cannot replay what it missed while
 * disconnected — so a reconnect invalidates the task list and refetches once,
 * which is what makes the board correct again after a laptop wakes from sleep.
 */
export function useRealtimeBoard(boardId: string | undefined) {
  const dispatch = useAppDispatch();
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<PresenceMember[]>([]);

  useEffect(() => {
    if (!boardId) return;

    let hasConnectedBefore = false;
    const source = new EventSource(apiUrl(`/boards/${boardId}/stream`), {
      withCredentials: true,
    });

    const onReady = () => {
      setConnected(true);
      if (hasConnectedBefore) {
        // A reconnect means there is a gap in what we saw. Resync.
        dispatch(api.util.invalidateTags([{ type: "Task", id: "LIST" }]));
      }
      hasConnectedBefore = true;
    };

    const onUpserted = (event: MessageEvent<string>) => {
      const message = parse<{ origin: string | null; task: Task }>(event.data);
      if (!message || message.origin === CLIENT_ID) return;

      dispatch(
        api.util.updateQueryData("getTasks", boardId, (draft) => {
          const index = draft.findIndex((task) => task.id === message.task.id);
          if (index >= 0) draft[index] = message.task;
          else draft.push(message.task);
        })
      );
    };

    const onDeleted = (event: MessageEvent<string>) => {
      const message = parse<{ origin: string | null; taskId: string }>(event.data);
      if (!message || message.origin === CLIENT_ID) return;

      dispatch(
        api.util.updateQueryData("getTasks", boardId, (draft) => {
          const index = draft.findIndex((task) => task.id === message.taskId);
          if (index >= 0) draft.splice(index, 1);
        })
      );
    };

    const onPresence = (event: MessageEvent<string>) => {
      const message = parse<{ members: PresenceMember[] }>(event.data);
      if (message) setMembers(message.members);
    };

    // Only the thread's own query refetches, and only if something is showing it.
    const onCommentChanged = (event: MessageEvent<string>) => {
      const message = parse<{ origin: string | null; taskId: string }>(event.data);
      if (!message || message.origin === CLIENT_ID) return;
      dispatch(
        api.util.invalidateTags([
          { type: "Comment", id: message.taskId },
          { type: "Activity", id: message.taskId },
        ])
      );
    };

    const onLabelsChanged = (event: MessageEvent<string>) => {
      const message = parse<{ origin: string | null }>(event.data);
      if (!message || message.origin === CLIENT_ID) return;
      dispatch(api.util.invalidateTags([{ type: "Label", id: boardId }]));
    };

    const onViewsChanged = (event: MessageEvent<string>) => {
      const message = parse<{ origin: string | null }>(event.data);
      if (!message || message.origin === CLIENT_ID) return;
      dispatch(api.util.invalidateTags([{ type: "View", id: boardId }]));
    };

    // Membership or name changed: cheap to refetch, and rare enough not to patch.
    const onBoardChanged = () => {
      dispatch(api.util.invalidateTags(["Board"]));
    };

    // Sent only to this user, whichever board the connection is watching.
    const onTimeChanged = (event: MessageEvent<string>) => {
      const message = parse<{ origin: string | null; taskId: string }>(event.data);
      if (!message || message.origin === CLIENT_ID) return;
      dispatch(
        api.util.invalidateTags([
          { type: "Time", id: message.taskId },
          { type: "Time", id: "BOARD" },
        ])
      );
    };

    // Another tab of this person's started or stopped a timer.
    const onTimerChanged = () => {
      dispatch(api.util.invalidateTags(["Timer"]));
    };

    const onNotification = () => {
      dispatch(api.util.invalidateTags(["Notification"]));
    };

    const onError = () => {
      // EventSource retries on its own; reflect the outage in the UI meanwhile.
      setConnected(false);
    };

    source.addEventListener("ready", onReady);
    source.addEventListener("task.upserted", onUpserted as EventListener);
    source.addEventListener("task.deleted", onDeleted as EventListener);
    source.addEventListener("presence", onPresence as EventListener);
    source.addEventListener("board.changed", onBoardChanged);
    source.addEventListener("views.changed", onViewsChanged as EventListener);
    source.addEventListener("labels.changed", onLabelsChanged as EventListener);
    source.addEventListener("comment.changed", onCommentChanged as EventListener);
    source.addEventListener("notification.new", onNotification);
    source.addEventListener("time.changed", onTimeChanged as EventListener);
    source.addEventListener("timer.changed", onTimerChanged);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("ready", onReady);
      source.removeEventListener("task.upserted", onUpserted as EventListener);
      source.removeEventListener("task.deleted", onDeleted as EventListener);
      source.removeEventListener("presence", onPresence as EventListener);
      source.removeEventListener("board.changed", onBoardChanged);
      source.removeEventListener("views.changed", onViewsChanged as EventListener);
      source.removeEventListener("labels.changed", onLabelsChanged as EventListener);
      source.removeEventListener("comment.changed", onCommentChanged as EventListener);
      source.removeEventListener("notification.new", onNotification);
      source.removeEventListener("time.changed", onTimeChanged as EventListener);
      source.removeEventListener("timer.changed", onTimerChanged);
      source.removeEventListener("error", onError);
      source.close();
    };
  }, [boardId, dispatch]);

  return { connected, members };
}

/** A malformed frame should drop that one message, not tear down the stream. */
function parse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
