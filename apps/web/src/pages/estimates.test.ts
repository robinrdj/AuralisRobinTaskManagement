import { describe, expect, it } from "vitest";
import type { Task } from "@auralis/shared";
import { estimateRows } from "./estimates";

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("estimateRows", () => {
  it("compares tracked time with the estimate, worst overrun first", () => {
    const onTrack = task({ estimateMinutes: 60 });
    const over = task({ estimateMinutes: 30 });
    const tracked = new Map([
      [onTrack.id, 30 * 60],
      [over.id, 45 * 60],
    ]);

    const rows = estimateRows([onTrack, over], tracked);
    expect(rows.map((row) => row.task.id)).toEqual([over.id, onTrack.id]);
    expect(rows[0]!.ratio).toBeCloseTo(1.5);
    expect(rows[1]!.ratio).toBeCloseTo(0.5);
  });

  it("includes tasks with time but no estimate, after the estimated ones", () => {
    const estimated = task({ estimateMinutes: 60 });
    const unestimated = task();
    const rows = estimateRows([unestimated, estimated], new Map([[unestimated.id, 600]]));
    expect(rows.map((row) => row.task.id)).toEqual([estimated.id, unestimated.id]);
    expect(rows[1]).toMatchObject({ estimateSeconds: null, ratio: null, trackedSeconds: 600 });
  });

  it("leaves out tasks with neither", () => {
    expect(estimateRows([task()], new Map())).toEqual([]);
  });
});
