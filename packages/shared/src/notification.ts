/**
 * Notifications: things that happened to you, as opposed to the board's
 * activity log, which is things that happened to tasks.
 */
export const NOTIFICATION_KINDS = [
  "assigned",
  "mentioned",
  "board_invite",
  "unblocked",
  "due_soon",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface Notification {
  id: string;
  kind: NotificationKind;
  boardId: string | null;
  boardName: string | null;
  /** Null for board-level events, or once the task has been deleted. */
  taskId: string | null;
  /** What it was about when it happened — a task title or a board name. */
  subject: string;
  actorId: string | null;
  actorName: string | null;
  /** Extra detail, such as the due date for a due_soon reminder. */
  detail: string | null;
  readAt: string | null;
  createdAt: string;
}

/** One line of text for a notification, e.g. `Ada assigned you "Ship it"`. */
export function describeNotification(notification: Notification): string {
  const who = notification.actorName ?? "Someone";
  const subject = `"${notification.subject}"`;
  switch (notification.kind) {
    case "assigned":
      return `${who} assigned you ${subject}`;
    case "mentioned":
      return `${who} mentioned you on ${subject}`;
    case "board_invite":
      return `${who} added you to the board ${subject}`;
    case "unblocked":
      return `${subject} is ready to start: nothing is blocking it any more`;
    case "due_soon":
      return notification.detail === "today"
        ? `${subject} is due today`
        : `${subject} is due tomorrow`;
  }
}
