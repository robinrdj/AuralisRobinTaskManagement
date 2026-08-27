/**
 * Fractional indexing for board ordering.
 *
 * Cards carry a string `position` and are sorted lexicographically. To move a
 * card you compute a key that sits between its new neighbours — an O(1) write
 * touching one row, instead of renumbering the whole column. Two clients
 * dragging different cards at the same time produce different keys, so
 * concurrent drags merge rather than clobbering each other.
 *
 * A key is read as a base-62 fraction with an implied leading "0.", so
 * lexicographic order over keys matches numeric order over the fractions they
 * denote. Keys never end in the lowest digit, which is what guarantees a gap
 * always remains between any two distinct keys.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const ZERO = DIGITS[0]!;

function digit(char: string | undefined, fallback: number): number {
  if (char === undefined) return fallback;
  const value = DIGITS.indexOf(char);
  if (value < 0) throw new RangeError(`Invalid character in position key: ${char}`);
  return value;
}

/**
 * The midpoint of two base-62 fractions, `a` < `b`, where `b === null` means 1.
 * Returned keys never end in the lowest digit.
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new RangeError(`midpoint expects a < b, got ${a} >= ${b}`);
  }
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new RangeError("Position keys must not end in the lowest digit");
  }

  if (b !== null) {
    // Strip the longest common prefix and recurse on the remainder. `a` is
    // padded with the implicit trailing zeroes of a shorter fraction.
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }

  const digitA = digit(a[0], 0);
  const digitB = b === null ? BASE : digit(b[0], BASE);

  if (digitB - digitA > 1) {
    // Room to land on a digit strictly between the two.
    return DIGITS[Math.round((digitA + digitB) / 2)]!;
  }

  if (b !== null && b.length > 1) {
    // `b` has more precision to give; borrow its first digit.
    return b.slice(0, 1);
  }

  // The leading digits are consecutive, so descend a place within `a`.
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

/**
 * A key strictly between `before` and `after` in lexicographic order.
 * Pass null for either end to prepend to the start or append to the end.
 */
export function positionBetween(before: string | null, after: string | null): string {
  if (before === null && after === null) return DIGITS[Math.floor(BASE / 2)]!;
  if (before === null) return midpoint("", after);
  return midpoint(before, after);
}

/** Evenly spaced keys for seeding a column from scratch. */
export function initialPositions(count: number): string[] {
  const keys: string[] = [];
  let previous: string | null = null;
  for (let i = 0; i < count; i++) {
    previous = positionBetween(previous, null);
    keys.push(previous);
  }
  return keys;
}

/** The key for appending after everything currently in a column. */
export function positionAfterLast(positions: readonly string[]): string {
  if (positions.length === 0) return positionBetween(null, null);
  const sorted = [...positions].sort();
  return positionBetween(sorted[sorted.length - 1]!, null);
}

/** The key for prepending before everything currently in a column. */
export function positionBeforeFirst(positions: readonly string[]): string {
  if (positions.length === 0) return positionBetween(null, null);
  const sorted = [...positions].sort();
  return positionBetween(null, sorted[0]!);
}
