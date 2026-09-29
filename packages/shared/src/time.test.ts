import { describe, expect, it } from "vitest";
import { entrySeconds, formatClock, formatDuration } from "./time.js";

describe("formatDuration", () => {
  it("uses the largest sensible unit", () => {
    expect(formatDuration(40)).toBe("40s");
    expect(formatDuration(25 * 60)).toBe("25m");
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe("2h 05m");
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("formatClock", () => {
  it("shows hours, minutes and seconds", () => {
    expect(formatClock(249)).toBe("0:04:09");
    expect(formatClock(3 * 3600 + 7)).toBe("3:00:07");
  });
});

describe("entrySeconds", () => {
  it("measures a finished entry", () => {
    expect(
      entrySeconds({ startedAt: "2026-03-01T10:00:00Z", endedAt: "2026-03-01T10:30:00Z" })
    ).toBe(1800);
  });

  it("counts a running timer up to now", () => {
    const now = new Date("2026-03-01T10:01:30Z");
    expect(entrySeconds({ startedAt: "2026-03-01T10:00:00Z", endedAt: null }, now)).toBe(90);
  });

  it("never goes negative when clocks disagree", () => {
    const now = new Date("2026-03-01T09:59:00Z");
    expect(entrySeconds({ startedAt: "2026-03-01T10:00:00Z", endedAt: null }, now)).toBe(0);
  });
});
