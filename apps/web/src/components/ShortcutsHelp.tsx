import { motion } from "motion/react";
import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { Button } from "./ui/primitives";

/**
 * The `?` sheet.
 *
 * Keyboard shortcuts that are not written down anywhere are shortcuts nobody
 * finds. The list is generated from the same constant the handler documents,
 * so the sheet cannot drift from the behaviour.
 */
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-heading"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-5 shadow-[var(--shadow-overlay)]"
      >
        <h2
          id="shortcuts-heading"
          className="text-base font-semibold text-[var(--text-primary)]"
        >
          Keyboard shortcuts
        </h2>

        <dl className="mt-4 flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0">
                <kbd className="rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-2xs text-[var(--text-secondary)]">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="min-w-0 flex-1 text-right text-sm text-[var(--text-secondary)]">
                {shortcut.description}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Card shortcuts act on whichever card has focus. Tab to reach one.
        </p>

        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose} autoFocus>
            Got it
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
