import {
  formatDate,
  RECURRENCE_LABELS,
  type Activity,
  type ActivityKind,
  type TaskRecurrence,
} from "@auralis/shared";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/components/ui/labels";

/**
 * Turns an activity row into a sentence.
 *
 * The log stores field-level before/after pairs rather than prose, so the
 * wording lives here and the stored events stay language-neutral and
 * queryable. Kept pure so the phrasing can be asserted directly.
 */

/** Field names as a reader would say them, not as the column is spelled. */
const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  dueDate: "due date",
  assigneeId: "assignee",
  position: "position",
  parentId: "parent task",
  labels: "labels",
  recurrence: "repeat",
};

interface Change {
  from: unknown;
  to: unknown;
}

function isChange(value: unknown): value is Change {
  return typeof value === "object" && value !== null && "to" in value;
}

/** Renders a single field value the way it appears in the UI. */
function renderValue(field: string, value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  if (value === null || value === undefined || value === "") return "empty";

  switch (field) {
    case "status":
      return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? String(value);
    case "priority":
      return PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS] ?? String(value);
    case "dueDate":
      return formatDate(String(value));
    case "recurrence":
      return RECURRENCE_LABELS[value as TaskRecurrence] ?? String(value);
    default:
      return String(value);
  }
}

const KIND_VERBS: Record<ActivityKind, string> = {
  "task.created": "created this task",
  "task.updated": "made a change",
  "task.moved": "moved it",
  "task.completed": "marked it done",
  "task.reopened": "reopened it",
  "task.deleted": "deleted it",
  "task.assigned": "changed the assignee",
  "comment.added": "commented",
};

export interface ActivityLine {
  /** The headline sentence. */
  summary: string;
  /** Field-level detail, one line each. Empty for events with no diff. */
  details: string[];
}

export function describeActivity(activity: Activity): ActivityLine {
  const payload = activity.payload ?? {};

  if (activity.kind === "task.created") {
    return {
      summary:
        payload.recurring === true
          ? "added this as the next occurrence of a repeating task"
          : "created this task",
      details: [],
    };
  }

  if (activity.kind === "task.deleted") {
    return { summary: "deleted this task", details: [] };
  }

  // A bulk edit reports the shared change rather than per-task diffs.
  if (payload.bulk === true) {
    const updates = payload.updates;
    const fields = typeof updates === "object" && updates !== null ? Object.keys(updates) : [];
    return {
      summary: "changed it as part of a bulk edit",
      details: fields.map((field) => {
        const value = (updates as Record<string, unknown>)[field];
        return `${FIELD_LABELS[field] ?? field} → ${renderValue(field, value)}`;
      }),
    };
  }

  const details: string[] = [];
  for (const [field, change] of Object.entries(payload)) {
    if (!isChange(change)) continue;
    // Position changes are an implementation detail of ordering; a reader does
    // not care that a fractional index went from "a0V" to "a1".
    if (field === "position") continue;
    details.push(
      `${FIELD_LABELS[field] ?? field}: ${renderValue(field, change.from)} → ${renderValue(
        field,
        change.to
      )}`
    );
  }

  const summary = KIND_VERBS[activity.kind] ?? "made a change";

  // A move whose only recorded diff was the position has nothing to show.
  if (details.length === 0 && activity.kind === "task.updated") {
    return { summary: "made a change", details: [] };
  }

  return { summary, details };
}

/** "just now", "12 minutes ago", "3 days ago". */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(elapsed)) return "";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
