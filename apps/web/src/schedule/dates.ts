/**
 * Calendar-day arithmetic for the schedule views.
 *
 * Days are ISO strings throughout and are converted to UTC midnight only to
 * do sums, so no timezone or daylight-saving change can move a task by a day.
 */

export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return formatDay(new Date(parseDay(iso).getTime() + days * 86_400_000));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (parseDay(iso).getUTCDay() + 6) % 7;
}

/** The local calendar day an instant falls on, in the viewer's timezone. */
export function localDay(instant: string): string {
  const date = new Date(instant);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
