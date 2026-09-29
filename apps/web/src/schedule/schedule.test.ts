import { describe, expect, it } from "vitest";
import type { Task } from "@auralis/shared";
import { groupByDueDate, monthGrid, shiftMonth } from "./calendar";
import { addDays, daysBetween, weekdayIndex } from "./dates";
import { layoutTimeline } from "./timeline";

let counter = 0;
function task(overrides: Partial<Task> = {}): Task {
  counter++;
  return {
    id: `task-${counter}`,
    boardId: "board",
    title: `Task ${counter}`,
    description: "",
    status: "todo",
    priority: "low",
    dueDate: null,
    assigneeId: null,
    position: "a0",
    parentId: null,
    // Midday local time, so the local calendar day is unambiguous in any zone.
    createdAt: new Date(2026, 2, 1, 12).toISOString(),
    updatedAt: new Date(2026, 2, 1, 12).toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("day arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is not thrown off by a daylight-saving change", () => {
    // Clocks change in late March in Europe and mid-March in the US.
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("numbers weekdays from Monday", () => {
    expect(weekdayIndex("2026-03-02")).toBe(0); // Monday
    expect(weekdayIndex("2026-03-08")).toBe(6); // Sunday
  });
});

describe("monthGrid", () => {
  it("covers whole weeks, Monday first", () => {
    // March 2026 starts on a Sunday and ends on a Tuesday.
    const days = monthGrid("2026-03");
    expect(days[0]).toBe("2026-02-23");
    expect(days.at(-1)).toBe("2026-04-05");
    expect(days.length % 7).toBe(0);
    expect(days).toContain("2026-03-31");
  });

  it("needs no padding for a month that starts on Monday and fits exactly", () => {
    // February 2027 starts on a Monday and has 28 days.
    const days = monthGrid("2027-02");
    expect(days[0]).toBe("2027-02-01");
    expect(days).toHaveLength(28);
  });

  it("steps between months and years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("groupByDueDate", () => {
  it("groups by day and puts open, urgent work first", () => {
    const done = task({ dueDate: "2026-03-10", status: "completed", priority: "urgent" });
    const low = task({ dueDate: "2026-03-10", priority: "low" });
    const urgent = task({ dueDate: "2026-03-10", priority: "urgent" });
    const undated = task();

    const grouped = groupByDueDate([done, low, urgent, undated]);
    expect(grouped.get("2026-03-10")!.map((t) => t.id)).toEqual([urgent.id, low.id, done.id]);
    expect([...grouped.keys()]).toEqual(["2026-03-10"]);
  });
});

describe("layoutTimeline", () => {
  it("draws a bar from creation to due date and counts undated tasks", () => {
    const dated = task({ dueDate: "2026-03-05" });
    const layout = layoutTimeline([dated, task()], [], "2026-03-02");

    expect(layout.undated).toBe(1);
    expect(layout.rows).toHaveLength(1);
    const row = layout.rows[0]!;
    expect(addDays(layout.from, row.start)).toBe("2026-03-01");
    expect(addDays(layout.from, row.end)).toBe("2026-03-05");
  });

  it("orders rows by when the work starts", () => {
    const later = task({
      createdAt: new Date(2026, 2, 4, 12).toISOString(),
      dueDate: "2026-03-09",
    });
    const earlier = task({ dueDate: "2026-03-20" });
    const layout = layoutTimeline([later, earlier], [], "2026-03-02");
    expect(layout.rows.map((row) => row.task.id)).toEqual([earlier.id, later.id]);
  });

  it("never draws a bar backwards", () => {
    const backdated = task({
      createdAt: new Date(2026, 2, 10, 12).toISOString(),
      dueDate: "2026-03-05",
    });
    const [row] = layoutTimeline([backdated], [], "2026-03-02").rows;
    expect(row!.start).toBe(row!.end);
  });

  it("flags a task due before the task it waits on", () => {
    const blocker = task({ dueDate: "2026-03-20" });
    const blocked = task({ dueDate: "2026-03-10" });
    const fine = task({ dueDate: "2026-03-25" });
    const layout = layoutTimeline(
      [blocker, blocked, fine],
      [
        { blockerId: blocker.id, blockedId: blocked.id },
        { blockerId: blocker.id, blockedId: fine.id },
      ],
      "2026-03-02"
    );
    expect(layout.arrows.map((arrow) => arrow.conflict)).toEqual([true, false]);
  });

  it("does not flag a conflict once the blocker is done", () => {
    const blocker = task({ dueDate: "2026-03-20", status: "completed" });
    const blocked = task({ dueDate: "2026-03-10" });
    const layout = layoutTimeline(
      [blocker, blocked],
      [{ blockerId: blocker.id, blockedId: blocked.id }],
      "2026-03-02"
    );
    expect(layout.arrows[0]!.conflict).toBe(false);
  });

  it("skips arrows to tasks that are not drawn", () => {
    const blocker = task({ dueDate: "2026-03-20" });
    const undated = task();
    const layout = layoutTimeline(
      [blocker, undated],
      [{ blockerId: blocker.id, blockedId: undated.id }],
      "2026-03-02"
    );
    expect(layout.arrows).toEqual([]);
  });

  it("caps a very long range around today", () => {
    const ancient = task({
      createdAt: new Date(2024, 0, 1, 12).toISOString(),
      dueDate: "2024-01-05",
    });
    const current = task({ dueDate: "2026-03-10" });
    const layout = layoutTimeline([ancient, current], [], "2026-03-02");
    expect(layout.days).toBeLessThanOrEqual(180);
    expect(layout.from).toBe("2026-01-31");
  });
});
