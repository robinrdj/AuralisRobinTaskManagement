import { describe, expect, it } from "vitest";
import type { Activity } from "@auralis/shared";
import { describeActivity, formatRelativeTime } from "./activityText";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    taskId: "task-1",
    boardId: "board-1",
    actorId: "user-1",
    kind: "task.updated",
    payload: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("describeActivity", () => {
  it("describes creation and deletion without a diff", () => {
    expect(describeActivity(activity({ kind: "task.created" }))).toEqual({
      summary: "created this task",
      details: [],
    });
    expect(describeActivity(activity({ kind: "task.deleted" }))).toEqual({
      summary: "deleted this task",
      details: [],
    });
  });

  it("renders a status change with human labels, not enum values", () => {
    const line = describeActivity(
      activity({
        kind: "task.moved",
        payload: { status: { from: "todo", to: "inprogress" } },
      })
    );
    expect(line.summary).toBe("moved it");
    expect(line.details).toEqual(["status: To do → In progress"]);
  });

  it("renders a priority change with its label", () => {
    const line = describeActivity(
      activity({ payload: { priority: { from: "low", to: "urgent" } } })
    );
    expect(line.details).toEqual(["priority: Low → Urgent"]);
  });

  it("names fields the way a reader would, not the way the column is spelled", () => {
    const line = describeActivity(
      activity({ payload: { dueDate: { from: null, to: "2026-09-01" } } })
    );
    expect(line.details[0]).toMatch(/^due date: empty → /);
  });

  it("says 'empty' rather than showing null or a blank", () => {
    const line = describeActivity(
      activity({ payload: { description: { from: "something", to: "" } } })
    );
    expect(line.details).toEqual(["description: something → empty"]);
  });

  it("hides position changes, which mean nothing to a reader", () => {
    const line = describeActivity(
      activity({
        kind: "task.moved",
        payload: {
          status: { from: "todo", to: "review" },
          position: { from: "a0V", to: "a1V" },
        },
      })
    );
    expect(line.details).toEqual(["status: To do → In review"]);
  });

  it("falls back gracefully when only the position changed", () => {
    const line = describeActivity(
      activity({ payload: { position: { from: "a0V", to: "a1V" } } })
    );
    expect(line.summary).toBe("made a change");
    expect(line.details).toEqual([]);
  });

  it("describes a completion and a reopen", () => {
    expect(describeActivity(activity({ kind: "task.completed" })).summary).toBe(
      "marked it done"
    );
    expect(describeActivity(activity({ kind: "task.reopened" })).summary).toBe("reopened it");
  });

  it("summarises a bulk edit from its shared updates", () => {
    const line = describeActivity(
      activity({ payload: { bulk: true, updates: { priority: "high" } } })
    );
    expect(line.summary).toBe("changed it as part of a bulk edit");
    expect(line.details).toEqual(["priority → High"]);
  });

  it("survives a payload that is empty or malformed", () => {
    expect(() => describeActivity(activity({ payload: {} }))).not.toThrow();
    expect(() =>
      describeActivity(activity({ payload: { title: "not a change object" } }))
    ).not.toThrow();
    expect(describeActivity(activity({ payload: { title: "junk" } })).details).toEqual([]);
  });

  it("reports several changed fields, one line each", () => {
    const line = describeActivity(
      activity({
        payload: {
          title: { from: "Old", to: "New" },
          priority: { from: "low", to: "high" },
        },
      })
    );
    expect(line.details).toHaveLength(2);
    expect(line.details).toContain("title: Old → New");
    expect(line.details).toContain("priority: Low → High");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("describes recent times in minutes and hours", () => {
    expect(formatRelativeTime("2026-08-27T11:59:40.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-08-27T11:59:00.000Z", now)).toBe("1 minute ago");
    expect(formatRelativeTime("2026-08-27T11:48:00.000Z", now)).toBe("12 minutes ago");
    expect(formatRelativeTime("2026-08-27T09:00:00.000Z", now)).toBe("3 hours ago");
  });

  it("rolls up into days, months and years", () => {
    expect(formatRelativeTime("2026-08-24T12:00:00.000Z", now)).toBe("3 days ago");
    expect(formatRelativeTime("2026-06-27T12:00:00.000Z", now)).toBe("2 months ago");
    expect(formatRelativeTime("2024-08-27T12:00:00.000Z", now)).toBe("2 years ago");
  });

  it("uses the singular for exactly one unit", () => {
    expect(formatRelativeTime("2026-08-27T11:00:00.000Z", now)).toBe("1 hour ago");
    expect(formatRelativeTime("2026-08-26T12:00:00.000Z", now)).toBe("1 day ago");
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatRelativeTime("not a date", now)).toBe("");
  });
});
