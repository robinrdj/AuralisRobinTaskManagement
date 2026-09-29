import { describe, expect, it } from "vitest";
import { nextOccurrence } from "./recurrence.js";

describe("nextOccurrence", () => {
  it("steps a daily task by one day", () => {
    expect(nextOccurrence("2026-03-10", "daily", "2026-03-10")).toBe("2026-03-11");
  });

  it("steps a weekly task by seven days", () => {
    expect(nextOccurrence("2026-03-10", "weekly", "2026-03-10")).toBe("2026-03-17");
  });

  it("keeps an early-finished task on its own schedule", () => {
    // Done a week ahead of time: the next one is still a week after the due date.
    expect(nextOccurrence("2026-03-17", "weekly", "2026-03-10")).toBe("2026-03-24");
  });

  it("skips ahead when a task was finished late, rather than scheduling the past", () => {
    // Due on a Monday, done three and a half weeks later.
    expect(nextOccurrence("2026-03-02", "weekly", "2026-03-25")).toBe("2026-03-30");
  });

  it("lets a late daily task land on today", () => {
    expect(nextOccurrence("2026-03-08", "daily", "2026-03-10")).toBe("2026-03-10");
  });

  it("counts from today when the task has no due date", () => {
    expect(nextOccurrence(null, "daily", "2026-03-10")).toBe("2026-03-11");
    expect(nextOccurrence(null, "weekly", "2026-03-10")).toBe("2026-03-17");
  });

  it("jumps from Friday to Monday for weekdays", () => {
    // 13 March 2026 is a Friday.
    expect(nextOccurrence("2026-03-13", "weekdays", "2026-03-13")).toBe("2026-03-16");
  });

  it("moves a weekday task off a weekend", () => {
    // 14 March 2026 is a Saturday.
    expect(nextOccurrence("2026-03-14", "weekdays", "2026-03-14")).toBe("2026-03-16");
  });

  it("clamps the 31st to the end of a shorter month, then returns to the 31st", () => {
    expect(nextOccurrence("2026-01-31", "monthly", "2026-01-31")).toBe("2026-02-28");
    // Counting from the original anchor, a late finish lands back on the 31st.
    expect(nextOccurrence("2026-01-31", "monthly", "2026-03-05")).toBe("2026-03-31");
  });

  it("handles a leap-year February", () => {
    expect(nextOccurrence("2028-01-31", "monthly", "2028-01-31")).toBe("2028-02-29");
  });

  it("crosses a year boundary", () => {
    expect(nextOccurrence("2026-12-31", "daily", "2026-12-31")).toBe("2027-01-01");
    expect(nextOccurrence("2026-12-15", "monthly", "2026-12-15")).toBe("2027-01-15");
  });
});
