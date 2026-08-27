import { describe, expect, it } from "vitest";
import {
  initialPositions,
  positionAfterLast,
  positionBeforeFirst,
  positionBetween,
} from "./ordering.js";

describe("positionBetween", () => {
  it("produces a key that sorts between its neighbours", () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    const mid = positionBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it("prepends before the first key", () => {
    const first = positionBetween(null, null);
    const before = positionBetween(null, first);
    expect(before < first).toBe(true);
  });

  it("never returns a key ending in the lowest digit", () => {
    let previous: string | null = null;
    for (let i = 0; i < 200; i++) {
      previous = positionBetween(previous, null);
      expect(previous.endsWith("0")).toBe(false);
    }
  });

  it("rejects an inverted range", () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    expect(() => positionBetween(b, a)).toThrow(RangeError);
  });

  it("survives repeated subdivision of the same gap", () => {
    // The pathological case: dragging a card into the same slot over and
    // over. Keys grow in length but must never collide or invert.
    let lo = positionBetween(null, null);
    const hi = positionBetween(lo, null);
    const seen = new Set<string>([lo, hi]);
    for (let i = 0; i < 300; i++) {
      const next = positionBetween(lo, hi);
      expect(lo < next).toBe(true);
      expect(next < hi).toBe(true);
      expect(seen.has(next)).toBe(false);
      seen.add(next);
      lo = next;
    }
  });

  it("keeps a randomised sequence of inserts totally ordered", () => {
    const keys = initialPositions(5);
    for (let i = 0; i < 500; i++) {
      const at = Math.floor(Math.random() * (keys.length + 1));
      const before = at === 0 ? null : keys[at - 1]!;
      const after = at === keys.length ? null : keys[at]!;
      const key = positionBetween(before, after);
      keys.splice(at, 0, key);
    }
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("initialPositions", () => {
  it("returns ascending, unique keys", () => {
    const keys = initialPositions(50);
    expect(keys).toHaveLength(50);
    expect(new Set(keys).size).toBe(50);
    expect([...keys].sort()).toEqual(keys);
  });

  it("returns nothing for a count of zero", () => {
    expect(initialPositions(0)).toEqual([]);
  });
});

describe("column helpers", () => {
  it("appends after the highest key regardless of input order", () => {
    const keys = initialPositions(4);
    const shuffled = [keys[2]!, keys[0]!, keys[3]!, keys[1]!];
    const appended = positionAfterLast(shuffled);
    expect(keys.every((k) => k < appended)).toBe(true);
  });

  it("prepends before the lowest key regardless of input order", () => {
    const keys = initialPositions(4);
    const shuffled = [keys[3]!, keys[1]!, keys[0]!, keys[2]!];
    const prepended = positionBeforeFirst(shuffled);
    expect(keys.every((k) => prepended < k)).toBe(true);
  });

  it("handles an empty column", () => {
    expect(positionAfterLast([])).toBe(positionBeforeFirst([]));
  });
});
