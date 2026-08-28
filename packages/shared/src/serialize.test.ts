import { describe, expect, it } from "vitest";
import type { Task } from "./task.js";
import {
  exportFileName,
  parseCsv,
  tasksFromCsv,
  tasksFromFile,
  tasksFromJson,
  tasksToCsv,
  tasksToJson,
} from "./serialize.js";

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
    position: "a0V",
    parentId: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quotes", () => {
    expect(parseCsv('title\n"Ship it, then rest"')).toEqual([
      ["title"],
      ["Ship it, then rest"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('title\n"She said ""go"""')).toEqual([["title"], ['She said "go"']]);
  });

  it("keeps newlines inside quotes as one cell", () => {
    expect(parseCsv('title\n"line one\nline two"')).toEqual([
      ["title"],
      ["line one\nline two"],
    ]);
  });

  it("treats CRLF as a single row break", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("reads a final row with no trailing newline", () => {
    expect(parseCsv("a\n1")).toEqual([["a"], ["1"]]);
  });

  it("strips a UTF-8 BOM, which Excel writes", () => {
    expect(parseCsv("﻿title\nHello")[0]).toEqual(["title"]);
  });

  it("drops blank rows", () => {
    expect(parseCsv("a\n\n1\n\n")).toEqual([["a"], ["1"]]);
  });

  it("returns nothing for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("CSV round trip", () => {
  it("survives commas, quotes and newlines", () => {
    const original = [
      task({ title: 'A "quoted", tricky title', description: "line one\nline two" }),
    ];
    const parsed = tasksFromCsv(tasksToCsv(original));

    expect(parsed.problems).toEqual([]);
    expect(parsed.tasks[0]!.title).toBe('A "quoted", tricky title');
    expect(parsed.tasks[0]!.description).toBe("line one\nline two");
  });

  it("preserves every field it exports", () => {
    const original = [
      task({
        title: "Ship it",
        description: "Carefully",
        status: "review",
        priority: "urgent",
        dueDate: "2026-09-15",
      }),
    ];
    const parsed = tasksFromCsv(tasksToCsv(original));

    expect(parsed.tasks[0]).toMatchObject({
      title: "Ship it",
      description: "Carefully",
      status: "review",
      priority: "urgent",
      dueDate: "2026-09-15",
    });
  });

  it("writes a header even with no tasks", () => {
    expect(tasksToCsv([]).trim()).toBe(
      "title,description,status,priority,dueDate,createdAt,completedAt"
    );
  });
});

describe("JSON round trip", () => {
  it("preserves fields through an export and import", () => {
    const original = [task({ title: "Round trip", priority: "high", dueDate: "2026-10-01" })];
    const parsed = tasksFromJson(tasksToJson(original, "My Board"));

    expect(parsed.problems).toEqual([]);
    expect(parsed.tasks[0]).toMatchObject({
      title: "Round trip",
      priority: "high",
      dueDate: "2026-10-01",
    });
  });

  it("describes itself in the envelope", () => {
    const parsed = JSON.parse(tasksToJson([task(), task()], "Product"));
    expect(parsed.boardName).toBe("Product");
    expect(parsed.taskCount).toBe(2);
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("accepts a bare array as well as the envelope", () => {
    const parsed = tasksFromJson('[{"title":"Bare"}]');
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0]!.title).toBe("Bare");
  });
});

describe("import validation", () => {
  it("reports invalid JSON rather than throwing", () => {
    const result = tasksFromJson("{not json");
    expect(result.tasks).toEqual([]);
    expect(result.problems[0]!.message).toMatch(/not valid JSON/);
  });

  it("rejects a shape that is not a list of tasks", () => {
    const result = tasksFromJson('{"foo":1}');
    expect(result.tasks).toEqual([]);
    expect(result.problems).toHaveLength(1);
  });

  it("skips rows with no title but keeps the rest", () => {
    const result = tasksFromJson('[{"title":"Keep"},{"title":"  "},{"title":"Also keep"}]');
    expect(result.tasks.map((entry) => entry.title)).toEqual(["Keep", "Also keep"]);
    expect(result.problems).toEqual([{ row: 2, message: "Skipped: no title" }]);
  });

  it("falls back on an unknown status and says so", () => {
    const result = tasksFromJson('[{"title":"X","status":"archived"}]');
    expect(result.tasks[0]!.status).toBe("todo");
    expect(result.problems[0]!.message).toMatch(/Unknown status "archived"/);
  });

  it("falls back on an unknown priority and says so", () => {
    const result = tasksFromJson('[{"title":"X","priority":"critical"}]');
    expect(result.tasks[0]!.priority).toBe("low");
    expect(result.problems[0]!.message).toMatch(/Unknown priority/);
  });

  it("accepts status and priority in any case", () => {
    const result = tasksFromJson('[{"title":"X","status":"InProgress","priority":"HIGH"}]');
    expect(result.tasks[0]!.priority).toBe("high");
  });

  it("migrates v1 dd-MM-yyyy dates on the way in", () => {
    const result = tasksFromJson('[{"title":"X","dueDate":"26-08-2026"}]');
    expect(result.tasks[0]!.dueDate).toBe("2026-08-26");
    expect(result.problems).toEqual([]);
  });

  it("also reads the v1 due_date column name", () => {
    const result = tasksFromJson('[{"title":"X","due_date":"2026-08-26"}]');
    expect(result.tasks[0]!.dueDate).toBe("2026-08-26");
  });

  it("reports an unreadable date instead of rendering NaN later", () => {
    // v1 accepted these and showed "NaN-NaN-NaN" on the card.
    const result = tasksFromJson('[{"title":"X","dueDate":"tomorrow-ish"}]');
    expect(result.tasks[0]!.dueDate).toBeNull();
    expect(result.problems[0]!.message).toMatch(/Could not read the date/);
  });

  it("numbers CSV rows the way the user sees them", () => {
    const result = tasksFromCsv("title\nGood\n\nAlso good");
    expect(result.tasks).toHaveLength(2);
    // Blank lines are dropped, so row numbers count real rows.
    expect(result.problems).toEqual([]);
  });

  it("requires a title column in a CSV", () => {
    const result = tasksFromCsv("name,status\nNo title column,todo");
    expect(result.tasks).toEqual([]);
    expect(result.problems[0]!.message).toMatch(/must name the columns/);
  });

  it("ignores columns it does not recognise", () => {
    const result = tasksFromCsv("title,nonsense\nKeep me,whatever");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.title).toBe("Keep me");
  });

  it("truncates an over-long title rather than dropping the task", () => {
    const result = tasksFromJson(JSON.stringify([{ title: "x".repeat(500) }]));
    expect(result.tasks[0]!.title).toHaveLength(200);
    expect(result.problems[0]!.message).toMatch(/longer than 200/);
  });

  it("caps a very large file and says how much it read", () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ title: `Task ${i}` }));
    const result = tasksFromJson(JSON.stringify(many));
    expect(result.tasks).toHaveLength(1000);
    expect(result.problems[0]!.message).toMatch(/first 1000 of 1500/);
  });

  it("skips entries that are not objects", () => {
    const result = tasksFromJson('[{"title":"Fine"},"nope",null,42]');
    expect(result.tasks).toHaveLength(1);
    expect(result.problems).toHaveLength(3);
  });

  it("reports an empty CSV", () => {
    expect(tasksFromCsv("").problems[0]!.message).toMatch(/empty/);
  });
});

describe("tasksFromFile", () => {
  it("picks the parser from the extension", () => {
    expect(tasksFromFile("board.csv", "title\nFrom CSV").tasks[0]!.title).toBe("From CSV");
    expect(tasksFromFile("board.json", '[{"title":"From JSON"}]').tasks[0]!.title).toBe(
      "From JSON"
    );
  });

  it("is not confused by an uppercase extension", () => {
    expect(tasksFromFile("BOARD.CSV", "title\nUpper").tasks[0]!.title).toBe("Upper");
  });
});

describe("exportFileName", () => {
  it("slugs the board name and stamps the date", () => {
    expect(exportFileName("My Board!", "json")).toMatch(/^my-board-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("falls back when the name has nothing usable in it", () => {
    expect(exportFileName("!!!", "csv")).toMatch(/^board-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("keeps the name short", () => {
    const name = exportFileName("a".repeat(200), "json");
    expect(name.length).toBeLessThan(60);
  });
});
