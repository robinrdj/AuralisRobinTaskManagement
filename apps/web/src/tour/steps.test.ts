import { describe, expect, it } from "vitest";
import { selectStep, TOUR_STEPS, type TourFacts } from "./steps";
import type { Task } from "@auralis/shared";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    boardId: "board",
    title: "Task",
    description: "",
    status: "todo",
    priority: "low",
    dueDate: null,
    assigneeId: null,
    position: "a0V",
    parentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function facts(overrides: Partial<TourFacts> = {}): TourFacts {
  return {
    taskCount: 0,
    tasks: [],
    movedToStatuses: new Set(),
    visitedRoutes: new Set(["/board"]),
    currentRoute: "/board",
    hasUsedFilters: false,
    hasOpenedCommandPalette: false,
    idleMs: 0,
    overdueCount: 0,
    completedCount: 0,
    ...overrides,
  };
}

const NONE = new Set<string>();

describe("tour step selection", () => {
  it("greets a brand new, empty board", () => {
    expect(selectStep(facts(), NONE, NONE)?.id).toBe("welcome-empty");
  });

  it("stops offering the welcome once a task exists", () => {
    const step = selectStep(facts({ taskCount: 1, tasks: [makeTask()] }), NONE, NONE);
    expect(step?.id).not.toBe("welcome-empty");
  });

  it("advances on its own when the user acts, with nothing to click", () => {
    // The point of a predicate-driven engine: creating a task changes which
    // step applies, without anything having to advance a cursor.
    const seen = new Set(["welcome-empty"]);
    const step = selectStep(facts({ taskCount: 1, tasks: [makeTask()] }), seen, NONE);
    expect(step?.id).toBe("first-task-created");
  });

  it("suggests filters after the first drag", () => {
    const seen = new Set(["welcome-empty", "first-task-created"]);
    const step = selectStep(
      facts({ taskCount: 2, movedToStatuses: new Set(["inprogress"]) }),
      seen,
      NONE
    );
    expect(step?.id).toBe("first-move");
  });

  it("waits before offering to fill the board", () => {
    const seen = new Set(["welcome-empty"]);
    expect(selectStep(facts({ idleMs: 5_000 }), seen, NONE)).toBeNull();
    expect(selectStep(facts({ idleMs: 30_000 }), seen, NONE)?.id).toBe("offer-samples");
  });

  it("prioritises an overdue warning over lower-priority nudges", () => {
    const seen = new Set(["welcome-empty", "first-task-created", "first-move"]);
    const step = selectStep(
      facts({
        taskCount: 6,
        overdueCount: 3,
        movedToStatuses: new Set(["inprogress"]),
        hasUsedFilters: true,
      }),
      seen,
      NONE
    );
    expect(step?.id).toBe("overdue-warning");
  });

  it("never re-shows a once-only step", () => {
    const seen = new Set(TOUR_STEPS.filter((step) => step.once).map((step) => step.id));
    expect(selectStep(facts(), seen, NONE)).toBeNull();
  });

  it("lets a recurring condition speak up again after being seen", () => {
    const recurring = TOUR_STEPS.filter((step) => !step.once).map((step) => step.id);
    expect(recurring).toContain("overdue-warning");

    const seen = new Set(TOUR_STEPS.map((step) => step.id));
    const step = selectStep(facts({ taskCount: 5, overdueCount: 4 }), seen, NONE);
    expect(step?.id).toBe("overdue-warning");
  });

  it("honours a dismissal permanently, even for recurring steps", () => {
    const dismissed = new Set(["overdue-warning"]);
    const step = selectStep(facts({ taskCount: 5, overdueCount: 4 }), NONE, dismissed);
    expect(step?.id).not.toBe("overdue-warning");
  });

  it("says nothing at all once every step is dismissed", () => {
    const dismissed = new Set(TOUR_STEPS.map((step) => step.id));
    for (const state of [
      facts(),
      facts({ taskCount: 10, overdueCount: 5 }),
      facts({ taskCount: 3, completedCount: 3 }),
    ]) {
      expect(selectStep(state, NONE, dismissed)).toBeNull();
    }
  });

  it("celebrates only when everything is actually complete", () => {
    const seen = new Set(
      TOUR_STEPS.filter((step) => step.id !== "all-done").map((step) => step.id)
    );
    expect(selectStep(facts({ taskCount: 4, completedCount: 3 }), seen, NONE)).toBeNull();
    expect(selectStep(facts({ taskCount: 4, completedCount: 4 }), seen, NONE)?.id).toBe(
      "all-done"
    );
  });

  it("does not celebrate an empty board", () => {
    const seen = new Set(
      TOUR_STEPS.filter((step) => step.id !== "all-done").map((step) => step.id)
    );
    expect(selectStep(facts({ taskCount: 0, completedCount: 0 }), seen, NONE)).toBeNull();
  });

  it("keeps board-specific guidance off other routes", () => {
    const step = selectStep(facts({ currentRoute: "/analytics" }), NONE, NONE);
    expect(step?.id).not.toBe("welcome-empty");
  });

  it("gives every step a unique id and a message short enough to read", () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of TOUR_STEPS) {
      expect(step.message.split(/\s+/).length, step.id).toBeLessThanOrEqual(12);
    }
  });

  it("is deterministic — the same facts always pick the same step", () => {
    const state = facts({ taskCount: 5, overdueCount: 3 });
    const first = selectStep(state, NONE, NONE);
    for (let i = 0; i < 20; i++) {
      expect(selectStep(state, NONE, NONE)?.id).toBe(first?.id);
    }
  });
});
