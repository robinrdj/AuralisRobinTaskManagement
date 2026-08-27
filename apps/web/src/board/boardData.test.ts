import { describe, expect, it } from "vitest";
import type { Task } from "@auralis/shared";
import { buildBoard, groupSubtasks, matchesFilters, summarise } from "./boardData";
import { EMPTY_FILTERS, type Filters } from "@/store/uiSlice";

const NOW = new Date(2026, 7, 26); // 26 Aug 2026

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
    position: `a${String(counter).padStart(3, "0")}V`,
    parentId: null,
    createdAt: new Date(2026, 0, counter).toISOString(),
    updatedAt: new Date(2026, 0, counter).toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function filters(overrides: Partial<Filters> = {}): Filters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe("matchesFilters", () => {
  it("matches title and description case-insensitively", () => {
    const item = task({ title: "Refactor Auth", description: "Rotate the TOKENS" });
    expect(matchesFilters(item, filters({ search: "refactor" }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ search: "tokens" }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ search: "unrelated" }), NOW)).toBe(false);
  });

  it("ignores surrounding whitespace in the search", () => {
    const item = task({ title: "Deploy" });
    expect(matchesFilters(item, filters({ search: "   " }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ search: "  deploy  " }), NOW)).toBe(true);
  });

  it("filters by priority and status", () => {
    const item = task({ priority: "high", status: "review" });
    expect(matchesFilters(item, filters({ priorities: ["high"] }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ priorities: ["low"] }), NOW)).toBe(false);
    expect(matchesFilters(item, filters({ statuses: ["review"] }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ statuses: ["todo"] }), NOW)).toBe(false);
  });

  it("excludes unassigned tasks when filtering by assignee", () => {
    expect(matchesFilters(task(), filters({ assigneeIds: ["user-1"] }), NOW)).toBe(false);
    expect(
      matchesFilters(task({ assigneeId: "user-1" }), filters({ assigneeIds: ["user-1"] }), NOW)
    ).toBe(true);
  });

  it("applies date bounds inclusively and across month boundaries", () => {
    const item = task({ dueDate: "2026-09-01" });
    expect(matchesFilters(item, filters({ dueFrom: "2026-09-01" }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ dueTo: "2026-09-01" }), NOW)).toBe(true);
    // The v1 bug: "2026-09-01" vs "2026-08-26" must compare chronologically.
    expect(matchesFilters(item, filters({ dueFrom: "2026-08-26" }), NOW)).toBe(true);
    expect(matchesFilters(item, filters({ dueTo: "2026-08-26" }), NOW)).toBe(false);
  });

  it("excludes undated tasks from a date range", () => {
    expect(matchesFilters(task(), filters({ dueFrom: "2026-01-01" }), NOW)).toBe(false);
  });

  it("finds overdue work but never completed work", () => {
    const late = task({ dueDate: "2026-08-01", status: "todo" });
    const doneLate = task({ dueDate: "2026-08-01", status: "completed" });
    expect(matchesFilters(late, filters({ overdueOnly: true }), NOW)).toBe(true);
    expect(matchesFilters(doneLate, filters({ overdueOnly: true }), NOW)).toBe(false);
  });

  it("combines filters conjunctively", () => {
    const item = task({ priority: "high", status: "todo", title: "Ship" });
    expect(matchesFilters(item, filters({ priorities: ["high"], search: "ship" }), NOW)).toBe(
      true
    );
    expect(matchesFilters(item, filters({ priorities: ["high"], search: "nope" }), NOW)).toBe(
      false
    );
  });
});

describe("buildBoard", () => {
  const base = {
    filters: filters(),
    sortBy: "position" as const,
    sortDirection: "asc" as const,
    now: NOW,
  };

  it("returns every column even when some are empty", () => {
    const columns = buildBoard({ ...base, tasks: [task({ status: "todo" })] });
    expect(columns.map((column) => column.status)).toEqual([
      "todo",
      "inprogress",
      "review",
      "completed",
    ]);
    expect(columns.find((column) => column.status === "review")!.tasks).toEqual([]);
  });

  it("reports the unfiltered total alongside the filtered tasks", () => {
    const tasks = [
      task({ status: "todo", title: "keep" }),
      task({ status: "todo", title: "drop" }),
      task({ status: "todo", title: "keep too" }),
    ];
    const columns = buildBoard({ ...base, tasks, filters: filters({ search: "keep" }) });
    const todo = columns.find((column) => column.status === "todo")!;
    expect(todo.tasks).toHaveLength(2);
    expect(todo.totalCount).toBe(3);
  });

  it("hides subtasks from the top level by default", () => {
    const parent = task({ status: "todo" });
    const child = task({ status: "todo", parentId: parent.id });
    const columns = buildBoard({ ...base, tasks: [parent, child] });
    const todo = columns.find((column) => column.status === "todo")!;
    expect(todo.tasks).toHaveLength(1);
    expect(todo.tasks[0]!.id).toBe(parent.id);
  });

  it("sorts by position ascending by default", () => {
    const a = task({ status: "todo", position: "a1" });
    const b = task({ status: "todo", position: "a2" });
    const columns = buildBoard({ ...base, tasks: [b, a] });
    expect(columns[0]!.tasks.map((item) => item.position)).toEqual(["a1", "a2"]);
  });

  it("sorts by priority with the most urgent first", () => {
    const tasks = [
      task({ status: "todo", priority: "low" }),
      task({ status: "todo", priority: "urgent" }),
      task({ status: "todo", priority: "medium" }),
    ];
    const columns = buildBoard({ ...base, tasks, sortBy: "priority" });
    expect(columns[0]!.tasks.map((item) => item.priority)).toEqual(["urgent", "medium", "low"]);
  });

  it("sorts by due date chronologically across year boundaries", () => {
    const tasks = [
      task({ status: "todo", dueDate: "2027-01-05" }),
      task({ status: "todo", dueDate: "2026-12-31" }),
      task({ status: "todo", dueDate: "2026-09-02" }),
    ];
    const columns = buildBoard({ ...base, tasks, sortBy: "dueDate" });
    expect(columns[0]!.tasks.map((item) => item.dueDate)).toEqual([
      "2026-09-02",
      "2026-12-31",
      "2027-01-05",
    ]);
  });

  it("keeps undated tasks last in both sort directions", () => {
    const tasks = [
      task({ status: "todo", dueDate: null }),
      task({ status: "todo", dueDate: "2026-09-02" }),
      task({ status: "todo", dueDate: "2026-10-02" }),
    ];

    for (const direction of ["asc", "desc"] as const) {
      const columns = buildBoard({
        ...base,
        tasks,
        sortBy: "dueDate",
        sortDirection: direction,
      });
      expect(columns[0]!.tasks.at(-1)!.dueDate, direction).toBeNull();
    }
  });

  it("sorts by title without being case-sensitive", () => {
    const tasks = [
      task({ status: "todo", title: "banana" }),
      task({ status: "todo", title: "Apple" }),
      task({ status: "todo", title: "cherry" }),
    ];
    const columns = buildBoard({ ...base, tasks, sortBy: "title" });
    expect(columns[0]!.tasks.map((item) => item.title)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("reverses on descending", () => {
    const tasks = [task({ status: "todo", title: "a" }), task({ status: "todo", title: "b" })];
    const columns = buildBoard({ ...base, tasks, sortBy: "title", sortDirection: "desc" });
    expect(columns[0]!.tasks.map((item) => item.title)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const tasks = [task({ status: "todo", title: "b" }), task({ status: "todo", title: "a" })];
    const snapshot = tasks.map((item) => item.title);
    buildBoard({ ...base, tasks, sortBy: "title" });
    expect(tasks.map((item) => item.title)).toEqual(snapshot);
  });

  it("handles an empty board", () => {
    const columns = buildBoard({ ...base, tasks: [] });
    expect(columns).toHaveLength(4);
    expect(columns.every((column) => column.tasks.length === 0)).toBe(true);
  });
});

describe("groupSubtasks", () => {
  it("groups children under their parent in position order", () => {
    const parent = task();
    const second = task({ parentId: parent.id, position: "b" });
    const first = task({ parentId: parent.id, position: "a" });
    const grouped = groupSubtasks([parent, second, first]);
    expect(grouped.get(parent.id)!.map((item) => item.position)).toEqual(["a", "b"]);
  });

  it("returns nothing for a flat list", () => {
    expect(groupSubtasks([task(), task()]).size).toBe(0);
  });
});

describe("summarise", () => {
  it("counts completion, overdue and due-today", () => {
    const stats = summarise(
      [
        task({ status: "completed" }),
        task({ status: "todo", dueDate: "2026-08-01" }),
        task({ status: "todo", dueDate: "2026-08-26" }),
        task({ status: "todo" }),
      ],
      NOW
    );
    expect(stats).toEqual({
      total: 4,
      completed: 1,
      overdue: 1,
      dueToday: 1,
      completionRate: 25,
    });
  });

  it("reports zero rather than NaN for an empty board", () => {
    expect(summarise([], NOW).completionRate).toBe(0);
  });

  it("does not count a completed task as overdue", () => {
    const stats = summarise([task({ status: "completed", dueDate: "2020-01-01" })], NOW);
    expect(stats.overdue).toBe(0);
  });
});
