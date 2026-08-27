import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatRelativeDueDate,
  isOverdue,
  parseToISODate,
  toISODate,
} from "./dates.js";

describe("parseToISODate", () => {
  it("passes through ISO dates", () => {
    expect(parseToISODate("2026-08-26")).toBe("2026-08-26");
  });

  it("migrates the v1 dd-MM-yyyy format", () => {
    expect(parseToISODate("26-08-2026")).toBe("2026-08-26");
    expect(parseToISODate("01-01-2025")).toBe("2025-01-01");
  });

  it("returns null for empty and unparseable input rather than throwing", () => {
    expect(parseToISODate("")).toBeNull();
    expect(parseToISODate("   ")).toBeNull();
    expect(parseToISODate(null)).toBeNull();
    expect(parseToISODate(undefined)).toBeNull();
    expect(parseToISODate("not a date")).toBeNull();
  });

  it("rejects calendar dates that do not exist", () => {
    // `new Date("2026-02-31")` silently rolls over to March 3rd; v1 accepted it.
    expect(parseToISODate("2026-02-31")).toBeNull();
    expect(parseToISODate("2025-13-01")).toBeNull();
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(parseToISODate("2024-02-29")).toBe("2024-02-29");
    expect(parseToISODate("2025-02-29")).toBeNull();
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 7, 26); // 26 Aug 2026, local time

  it("counts forward and backward", () => {
    expect(daysUntil("2026-08-26", now)).toBe(0);
    expect(daysUntil("2026-08-27", now)).toBe(1);
    expect(daysUntil("2026-08-25", now)).toBe(-1);
  });

  it("crosses month and year boundaries correctly", () => {
    // This is the case string comparison got wrong: "2026-09-01" sorts after
    // "2026-08-26" by luck, but "2026-1-5" style inputs did not.
    expect(daysUntil("2026-09-01", now)).toBe(6);
    expect(daysUntil("2027-01-01", now)).toBe(128);
    expect(daysUntil("2025-12-31", now)).toBe(-238);
  });

  it("is unaffected by a DST transition in the range", () => {
    const beforeDst = new Date(2026, 2, 1);
    expect(daysUntil("2026-04-01", beforeDst)).toBe(31);
  });
});

describe("isOverdue", () => {
  const now = new Date(2026, 7, 26);

  it("flags a past due date on an open task", () => {
    expect(isOverdue({ dueDate: "2026-08-25", status: "todo" }, now)).toBe(true);
  });

  it("does not flag a task due today", () => {
    expect(isOverdue({ dueDate: "2026-08-26", status: "todo" }, now)).toBe(false);
  });

  it("never flags a completed task", () => {
    expect(isOverdue({ dueDate: "2020-01-01", status: "completed" }, now)).toBe(false);
  });

  it("never flags a task with no due date", () => {
    expect(isOverdue({ dueDate: null, status: "todo" }, now)).toBe(false);
  });

  it("flags a task overdue by a year", () => {
    expect(isOverdue({ dueDate: "2025-08-26", status: "inprogress" }, now)).toBe(true);
  });
});

describe("ISO dates sort chronologically as strings", () => {
  it("orders correctly across boundaries where dd-MM-yyyy did not", () => {
    const legacy = ["26-08-2026", "01-01-2027", "05-12-2026"];
    const migrated = legacy.map((d) => parseToISODate(d)!);
    expect([...migrated].sort()).toEqual(["2026-08-26", "2026-12-05", "2027-01-01"]);
    // The same three dates sorted in their original format are wrong:
    expect([...legacy].sort()).toEqual(["01-01-2027", "05-12-2026", "26-08-2026"]);
  });
});

describe("formatRelativeDueDate", () => {
  const now = new Date(2026, 7, 26);

  it("describes the near future and past in words", () => {
    expect(formatRelativeDueDate("2026-08-26", now)).toBe("Due today");
    expect(formatRelativeDueDate("2026-08-27", now)).toBe("Due tomorrow");
    expect(formatRelativeDueDate("2026-08-25", now)).toBe("1 day overdue");
    expect(formatRelativeDueDate("2026-08-20", now)).toBe("6 days overdue");
    expect(formatRelativeDueDate("2026-08-30", now)).toBe("Due in 4 days");
    expect(formatRelativeDueDate(null, now)).toBe("No due date");
  });
});

describe("toISODate", () => {
  it("pads single-digit months and days", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
