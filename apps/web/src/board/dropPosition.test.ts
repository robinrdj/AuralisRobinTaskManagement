import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "@auralis/shared";
import { initialPositions } from "@auralis/shared";
import { resolveDropPosition, resolveDropTarget } from "./dropPosition";

let counter = 0;
function task(position: string, status: TaskStatus = "todo", id?: string): Task {
  counter++;
  return {
    id: id ?? `task-${counter}`,
    boardId: "board",
    title: `Task ${counter}`,
    description: "",
    status,
    priority: "low",
    dueDate: null,
    assigneeId: null,
    position,
    parentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

describe("resolveDropPosition", () => {
  it("places a card between its two neighbours", () => {
    const [a, b, c] = initialPositions(3) as [string, string, string];
    const column = [task(a), task(b), task(c)];
    const dropped = resolveDropPosition(column, 1);
    expect(a < dropped).toBe(true);
    expect(dropped < b).toBe(true);
  });

  it("places a card before everything when dropped at the top", () => {
    const [a, b] = initialPositions(2) as [string, string];
    const dropped = resolveDropPosition([task(a), task(b)], 0);
    expect(dropped < a).toBe(true);
  });

  it("places a card after everything when dropped at the end", () => {
    const [a, b] = initialPositions(2) as [string, string];
    const dropped = resolveDropPosition([task(a), task(b)], 2);
    expect(b < dropped).toBe(true);
  });

  it("handles an empty column", () => {
    expect(resolveDropPosition([], 0)).toBeTruthy();
  });

  it("clamps an index past the end", () => {
    const [a] = initialPositions(1) as [string];
    const dropped = resolveDropPosition([task(a)], 99);
    expect(a < dropped).toBe(true);
  });

  it("clamps a negative index", () => {
    const [a] = initialPositions(1) as [string];
    const dropped = resolveDropPosition([task(a)], -5);
    expect(dropped < a).toBe(true);
  });

  it("falls back to appending when neighbours share a key", () => {
    // Concurrent writes can briefly produce duplicate positions; the drag must
    // still resolve rather than throwing in the user's face.
    const column = [task("a1"), task("a1"), task("a5")];
    expect(() => resolveDropPosition(column, 1)).not.toThrow();
    expect(resolveDropPosition(column, 1) > "a5").toBe(true);
  });

  it("keeps the column ordered across a long run of drops", () => {
    const positions = initialPositions(6);
    const column = positions.map((position) => task(position));

    for (let i = 0; i < 200; i++) {
      const index = Math.floor(Math.random() * (column.length + 1));
      const position = resolveDropPosition(column, index);
      column.splice(index, 0, task(position));
      const keys = column.map((item) => item.position);
      expect([...keys].sort()).toEqual(keys);
    }
    expect(new Set(column.map((item) => item.position)).size).toBe(column.length);
  });
});

describe("resolveDropTarget", () => {
  const [a, b, c] = initialPositions(3) as [string, string, string];

  function columns() {
    return [
      { status: "todo" as const, tasks: [task(a, "todo", "t1"), task(b, "todo", "t2")] },
      { status: "inprogress" as const, tasks: [task(c, "inprogress", "p1")] },
      { status: "review" as const, tasks: [] },
      { status: "completed" as const, tasks: [] },
    ];
  }

  it("appends when dropped on a column itself", () => {
    const cols = columns();
    const target = resolveDropTarget(cols[0]!.tasks[0]!, "inprogress", cols);
    expect(target).toEqual({ status: "inprogress", index: 1 });
  });

  it("appends to an empty column", () => {
    const cols = columns();
    const target = resolveDropTarget(cols[0]!.tasks[0]!, "review", cols);
    expect(target).toEqual({ status: "review", index: 0 });
  });

  it("excludes the dragged card when appending to its own column", () => {
    const cols = columns();
    // Two cards in "todo"; dropping one back on the column leaves one other.
    const target = resolveDropTarget(cols[0]!.tasks[0]!, "todo", cols);
    expect(target).toEqual({ status: "todo", index: 1 });
  });

  it("takes the slot of the card it was dropped on", () => {
    const cols = columns();
    const target = resolveDropTarget(cols[0]!.tasks[0]!, "p1", cols);
    expect(target).toEqual({ status: "inprogress", index: 0 });
  });

  it("returns null when the drop target is unknown", () => {
    const cols = columns();
    expect(resolveDropTarget(cols[0]!.tasks[0]!, "nonexistent", cols)).toBeNull();
  });
});
