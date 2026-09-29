import { describe, expect, it } from "vitest";
import { describeNotification, type Notification } from "./notification.js";

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: "n",
    kind: "assigned",
    boardId: "b",
    boardName: "Board",
    taskId: "t",
    subject: "Ship it",
    actorId: "a",
    actorName: "Ada",
    detail: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("describeNotification", () => {
  it("names who did what", () => {
    expect(describeNotification(notification({ kind: "assigned" }))).toBe(
      'Ada assigned you "Ship it"'
    );
    expect(describeNotification(notification({ kind: "mentioned" }))).toBe(
      'Ada mentioned you on "Ship it"'
    );
    expect(
      describeNotification(
        notification({ kind: "board_invite", subject: "Launch", taskId: null })
      )
    ).toBe('Ada added you to the board "Launch"');
  });

  it("copes with an actor whose account is gone", () => {
    expect(describeNotification(notification({ actorName: null }))).toBe(
      'Someone assigned you "Ship it"'
    );
  });

  it("describes reminders and unblocked work", () => {
    expect(describeNotification(notification({ kind: "due_soon", detail: "today" }))).toBe(
      '"Ship it" is due today'
    );
    expect(describeNotification(notification({ kind: "due_soon", detail: "tomorrow" }))).toBe(
      '"Ship it" is due tomorrow'
    );
    expect(describeNotification(notification({ kind: "unblocked" }))).toBe(
      '"Ship it" is ready to start: nothing is blocking it any more'
    );
  });
});
