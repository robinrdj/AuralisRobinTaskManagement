import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  exportFileName,
  tasksFromFile,
  tasksToCsv,
  tasksToJson,
  type ImportResult,
  type Task,
} from "@auralis/shared";
import { Button } from "@/components/ui/primitives";
import { cx } from "@/components/ui/labels";

/**
 * Export and import.
 *
 * Both existed in v1 and were lost in the rewrite; this restores them. The
 * parsing lives in the shared package so it is unit-tested rather than only
 * exercised by clicking, and so the server could reuse it unchanged.
 */
export function ImportExport({
  tasks,
  boardName,
  onImport,
}: {
  tasks: Task[];
  boardName: string;
  onImport: (imported: ImportResult["tasks"]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Triggers a download without touching the network.
   *
   * The object URL is revoked on the next frame — revoking it synchronously
   * races the browser's own read of the blob in Safari.
   */
  const download = (contents: string, fileName: string, mime: string) => {
    const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    requestAnimationFrame(() => URL.revokeObjectURL(url));
    setOpen(false);
  };

  const readFile = async (file: File) => {
    const text = await file.text();
    setPreview(tasksFromFile(file.name, text));
    setOpen(false);
  };

  return (
    <>
      <div className="relative">
        <Button
          size="md"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 2v8m0 0L5 7m3 3l3-3M2.5 11.5v1a1 1 0 001 1h9a1 1 0 001-1v-1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Data
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              role="menu"
              className="absolute right-0 z-40 mt-1.5 w-56 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1.5 shadow-[var(--shadow-overlay)]"
            >
              <p className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Export {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </p>
              <MenuItem
                onClick={() =>
                  download(
                    tasksToJson(tasks, boardName),
                    exportFileName(boardName, "json"),
                    "application/json"
                  )
                }
              >
                Download JSON
              </MenuItem>
              <MenuItem
                onClick={() =>
                  download(tasksToCsv(tasks), exportFileName(boardName, "csv"), "text/csv")
                }
              >
                Download CSV
              </MenuItem>

              <div className="my-1 border-t border-[var(--border-subtle)]" />
              <MenuItem onClick={() => fileRef.current?.click()}>Import a file…</MenuItem>
              <p className="px-2.5 pb-1 pt-0.5 text-2xs text-[var(--text-muted)]">
                JSON or CSV. Nothing is added until you confirm.
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="sr-only"
        aria-label="Choose a file to import"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so choosing the same file twice fires a change event again.
          event.target.value = "";
          if (file) void readFile(file);
        }}
      />

      {preview && (
        <ImportPreview
          result={preview}
          busy={importing}
          onCancel={() => setPreview(null)}
          onConfirm={async () => {
            setImporting(true);
            try {
              await onImport(preview.tasks);
              setPreview(null);
            } finally {
              setImporting(false);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Shows what an import will do before it does it.
 *
 * v1 imported straight from the file picker, so a malformed row became a card
 * reading "NaN-NaN-NaN" that you then had to find and fix. Nothing is written
 * until this is confirmed.
 */
function ImportPreview({
  result,
  busy,
  onCancel,
  onConfirm,
}: {
  result: ImportResult;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { tasks, problems } = result;
  const canImport = tasks.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-heading"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)]"
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="import-heading" className="text-lg font-semibold text-[var(--text-primary)]">
            {canImport
              ? `Import ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}?`
              : "Nothing to import"}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {canImport
              ? "They will be added to your board. You can undo it straight after."
              : "No usable tasks were found in that file."}
          </p>
        </div>

        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {canImport && (
            <ol className="mb-3 flex flex-col gap-1">
              {tasks.slice(0, 8).map((task, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 text-sm text-[var(--text-primary)]"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(--priority-${task.priority})` }}
                  />
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                </li>
              ))}
              {tasks.length > 8 && (
                <li className="text-xs text-[var(--text-muted)]">
                  …and {tasks.length - 8} more
                </li>
              )}
            </ol>
          )}

          {problems.length > 0 && (
            <div className="rounded-[var(--radius-control)] border border-[var(--warning)] bg-[var(--warning-subtle)] p-3">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {problems.length} {problems.length === 1 ? "note" : "notes"}
              </p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {problems.slice(0, 10).map((problem, index) => (
                  <li key={index} className="text-xs text-[var(--text-secondary)]">
                    {problem.row > 0 && (
                      <span className="tabular-nums text-[var(--text-muted)]">
                        Row {problem.row}:{" "}
                      </span>
                    )}
                    {problem.message}
                  </li>
                ))}
                {problems.length > 10 && (
                  <li className="text-xs text-[var(--text-muted)]">
                    …and {problems.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canImport || busy} onClick={onConfirm}>
            {busy ? "Importing…" : `Import ${tasks.length}`}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        "w-full rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-sm",
        "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
      )}
    >
      {children}
    </button>
  );
}
