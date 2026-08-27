/**
 * Date handling.
 *
 * Rule: timestamps are ISO-8601 in storage and in transit, and are only
 * converted to human-readable form at the moment of render. Nothing in
 * this codebase parses a localised date string back into a Date.
 */

/** A calendar day in the viewer's local zone, e.g. "2026-08-26". */
export function toISODate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Parse a user- or import-supplied date into an ISO calendar date.
 *
 * Accepts ISO ("2026-08-26"), the dd-MM-yyyy format written by v1 of this
 * app, and anything `Date` can parse. Returns null rather than throwing so
 * bulk imports can report per-row failures instead of aborting.
 */
export function parseToISODate(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isRealDate(trimmed) ? trimmed : null;
  }

  // Legacy v1 format: dd-MM-yyyy.
  const legacy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (legacy) {
    const candidate = `${legacy[3]}-${legacy[2]}-${legacy[1]}`;
    return isRealDate(candidate) ? candidate : null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : toISODate(parsed);
}

/** Guards against "2026-02-31" and friends, which `new Date` silently rolls over. */
function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole days from today until `dueDate`. Negative means overdue. */
export function daysUntil(dueDate: string, now = new Date()): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return Number.NaN;
  const due = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
}

/**
 * A task is overdue when its due date is strictly before today and it has
 * not been completed. Comparing ISO dates as numbers-of-days rather than as
 * strings is what makes this correct across month and year boundaries.
 */
export function isOverdue(
  task: { dueDate: string | null; status: string },
  now = new Date()
): boolean {
  if (!task.dueDate || task.status === "completed") return false;
  return daysUntil(task.dueDate, now) < 0;
}

const DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Render-time only. Uses the viewer's locale rather than hardcoding one. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return DAY_FORMATTER.format(new Date(y, m - 1, d));
}

/** "in 3 days" / "2 days ago" / "today". */
export function formatRelativeDueDate(iso: string | null, now = new Date()): string {
  if (!iso) return "No due date";
  const days = daysUntil(iso, now);
  if (Number.isNaN(days)) return "No due date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `Due in ${days} days`;
}
