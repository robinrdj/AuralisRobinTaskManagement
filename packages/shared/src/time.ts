import { z } from "zod";
import { isoDateSchema } from "./task.js";

/**
 * Time tracking: timers you start and stop on a task, plus time added by
 * hand. A person has at most one running timer; starting another stops it.
 */

export interface TimeEntry {
  id: string;
  taskId: string;
  boardId: string;
  userId: string | null;
  userName: string | null;
  startedAt: string;
  /** Null while the timer is running. */
  endedAt: string | null;
  note: string | null;
}

export interface RunningTimer extends TimeEntry {
  taskTitle: string;
}

export const manualTimeSchema = z.object({
  minutes: z
    .number()
    .int()
    .min(1, "Add at least a minute")
    .max(24 * 60),
  /** The day the work happened; today when omitted. */
  date: isoDateSchema.optional(),
  note: z.string().trim().max(200).optional(),
});

export const estimateSchema = z.number().int().min(1).max(1_000_000).nullable();

/** Seconds an entry covers, counting a running timer up to `now`. */
export function entrySeconds(
  entry: Pick<TimeEntry, "startedAt" | "endedAt">,
  now = new Date()
) {
  const end = entry.endedAt ? new Date(entry.endedAt) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(entry.startedAt).getTime()) / 1000));
}

/** "2h 05m", "25m", "40s" — compact, and never "0m" for real work. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** A running timer as a clock: "0:04:09". */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
