import { z } from "zod";
import { parseToISODate } from "./dates.js";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./task.js";

/**
 * Import and export.
 *
 * Kept in the shared package and free of any DOM or Node dependency, so the
 * same parser runs in the browser, on the server and in tests. CSV is
 * implemented here rather than pulled in: the format is small, and the
 * libraries that handle it are large and have a poor security history —
 * v1 shipped `xlsx`, 400KB with a run of advisories, to write one file.
 */

/** The columns an export writes and an import understands. */
export const EXPORT_COLUMNS = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "createdAt",
  "completedAt",
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/* -------------------------------------------------------------------------- */
/* CSV                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Quotes a field only when it needs it: a comma, a quote, a newline, or
 * leading/trailing whitespace that a reader would otherwise strip.
 */
function encodeCell(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function tasksToCsv(tasks: readonly Task[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const rows = tasks.map((task) =>
    EXPORT_COLUMNS.map((column) => encodeCell(task[column] ?? "")).join(",")
  );
  // A trailing newline is what most tools expect at the end of a CSV.
  return [header, ...rows].join("\r\n") + "\r\n";
}

/**
 * Splits CSV text into rows of cells.
 *
 * Handles quoted fields containing commas, escaped quotes (`""`), and
 * newlines inside quotes — the three things a naive `split(",")` gets wrong
 * and which a spreadsheet will happily produce.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM, which Excel writes and which would otherwise become
  // part of the first column name.
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      // Treat CRLF as one break rather than two empty rows.
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // A file that does not end in a newline still has a final row.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

export interface ImportedTask {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface ImportProblem {
  /** 1-based row number as the user sees it in their file. */
  row: number;
  message: string;
}

export interface ImportResult {
  tasks: ImportedTask[];
  problems: ImportProblem[];
}

/**
 * Coerces one loose record into a task.
 *
 * Import is deliberately forgiving about everything except the title: an
 * unrecognised status becomes "todo" rather than rejecting the row, because
 * losing a whole task over a spelling is worse than importing it in the wrong
 * column. Anything corrected this way is reported as a problem so the user
 * knows what happened.
 */
function coerceTask(
  raw: Record<string, unknown>,
  row: number,
  problems: ImportProblem[]
): ImportedTask | null {
  const title = String(raw.title ?? "").trim();
  if (!title) {
    problems.push({ row, message: "Skipped: no title" });
    return null;
  }
  if (title.length > 200) {
    problems.push({ row, message: "Title was longer than 200 characters and was cut" });
  }

  const rawStatus = String(raw.status ?? "")
    .trim()
    .toLowerCase();
  let status: TaskStatus = "todo";
  if (rawStatus) {
    if ((TASK_STATUSES as readonly string[]).includes(rawStatus)) {
      status = rawStatus as TaskStatus;
    } else {
      problems.push({ row, message: `Unknown status "${rawStatus}" — imported as To do` });
    }
  }

  const rawPriority = String(raw.priority ?? "")
    .trim()
    .toLowerCase();
  let priority: TaskPriority = "low";
  if (rawPriority) {
    if ((TASK_PRIORITIES as readonly string[]).includes(rawPriority)) {
      priority = rawPriority as TaskPriority;
    } else {
      problems.push({ row, message: `Unknown priority "${rawPriority}" — imported as Low` });
    }
  }

  const rawDue = raw.dueDate ?? raw.due_date;
  let dueDate: string | null = null;
  if (rawDue !== undefined && rawDue !== null && String(rawDue).trim() !== "") {
    dueDate = parseToISODate(String(rawDue));
    if (dueDate === null) {
      // v1 accepted these and rendered "NaN-NaN-NaN" on the card. Say so instead.
      problems.push({ row, message: `Could not read the date "${rawDue}" — left empty` });
    }
  }

  return {
    title: title.slice(0, 200),
    description: String(raw.description ?? "").slice(0, 10_000),
    status,
    priority,
    dueDate,
  };
}

const MAX_IMPORT_ROWS = 1000;

/** Parses a JSON export back into tasks. */
export function tasksFromJson(text: string): ImportResult {
  const problems: ImportProblem[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { tasks: [], problems: [{ row: 0, message: "That file is not valid JSON" }] };
  }

  // Accept both a bare array and the { tasks: [...] } envelope this app writes.
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { tasks?: unknown }).tasks)
      ? (parsed as { tasks: unknown[] }).tasks
      : null;

  if (!list) {
    return {
      tasks: [],
      problems: [
        { row: 0, message: 'Expected a list of tasks, or an object with a "tasks" list' },
      ],
    };
  }

  const capped = list.slice(0, MAX_IMPORT_ROWS);
  if (list.length > MAX_IMPORT_ROWS) {
    problems.push({
      row: 0,
      message: `Only the first ${MAX_IMPORT_ROWS} of ${list.length} tasks were read`,
    });
  }

  const tasks: ImportedTask[] = [];
  capped.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      problems.push({ row: index + 1, message: "Skipped: not a task object" });
      return;
    }
    const task = coerceTask(entry as Record<string, unknown>, index + 1, problems);
    if (task) tasks.push(task);
  });

  return { tasks, problems };
}

/** Parses a CSV export — or any spreadsheet with a matching header row. */
export function tasksFromCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { tasks: [], problems: [{ row: 0, message: "That file is empty" }] };
  }

  const header = rows[0]!.map((cell) => cell.trim());
  const titleIndex = header.findIndex((name) => name.toLowerCase() === "title");
  if (titleIndex < 0) {
    return {
      tasks: [],
      problems: [{ row: 1, message: 'The first row must name the columns, including "title"' }],
    };
  }

  const problems: ImportProblem[] = [];
  const body = rows.slice(1, MAX_IMPORT_ROWS + 1);
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    problems.push({
      row: 0,
      message: `Only the first ${MAX_IMPORT_ROWS} of ${rows.length - 1} rows were read`,
    });
  }

  const tasks: ImportedTask[] = [];
  body.forEach((cells, index) => {
    const record: Record<string, unknown> = {};
    header.forEach((name, column) => {
      record[name] = cells[column] ?? "";
    });
    // +2: one for the header row, one to count from 1.
    const task = coerceTask(record, index + 2, problems);
    if (task) tasks.push(task);
  });

  return { tasks, problems };
}

/** Picks the parser from the file name, defaulting to JSON. */
export function tasksFromFile(fileName: string, text: string): ImportResult {
  return fileName.toLowerCase().endsWith(".csv") ? tasksFromCsv(text) : tasksFromJson(text);
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export const exportEnvelopeSchema = z.object({
  exportedAt: z.string(),
  boardName: z.string(),
  taskCount: z.number(),
  tasks: z.array(z.record(z.unknown())),
});

/**
 * JSON export carries a small envelope so a file is self-describing when it
 * turns up in a downloads folder six months later.
 */
export function tasksToJson(tasks: readonly Task[], boardName: string): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      boardName,
      taskCount: tasks.length,
      tasks: tasks.map((task) =>
        Object.fromEntries(EXPORT_COLUMNS.map((column) => [column, task[column] ?? null]))
      ),
    },
    null,
    2
  );
}

/** A filesystem-safe file name stamped with today's date. */
export function exportFileName(boardName: string, extension: "json" | "csv"): string {
  const slug =
    boardName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "board";
  const today = new Date().toISOString().slice(0, 10);
  return `${slug}-${today}.${extension}`;
}
