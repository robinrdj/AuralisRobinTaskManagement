import { useEffect } from "react";
import { TASK_STATUSES, type Task, type TaskStatus } from "@auralis/shared";

export interface ShortcutHandlers {
  onNewTask: () => void;
  onMoveFocused: (task: Task, status: TaskStatus) => void;
  onDeleteFocused: (task: Task) => void;
  onOpenFocused: (task: Task) => void;
  onShowHelp: () => void;
  onEscape: () => void;
  /** Resolves the card the user is currently on, or null. */
  getFocusedTask: () => Task | null;
}

/**
 * True when a keystroke belongs to whatever the user is typing into.
 *
 * Without this, typing "n" into the search box opens the new-task dialog —
 * the classic way single-key shortcuts go wrong.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** The shortcuts, in the order the help sheet lists them. */
export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "Ctrl K", description: "Open the command palette" },
  { keys: "N", description: "New task" },
  { keys: "1 – 4", description: "Move the focused card between columns" },
  { keys: "Enter", description: "Open the focused card" },
  { keys: "Space", description: "Pick a card up, then move it with the arrows" },
  { keys: "Backspace", description: "Delete the focused card" },
  { keys: "?", description: "Show this list" },
  { keys: "Esc", description: "Close whatever is open" },
];

/**
 * Single-key shortcuts for the board.
 *
 * Deliberately not registered in the capture phase: unlike Ctrl-K, these must
 * lose to a text field, and a dialog on top of the board should get the key
 * first. Any modifier other than Shift is left alone, so browser and OS
 * shortcuts keep working.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handlers.onEscape();
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        handlers.onShowHelp();
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        handlers.onNewTask();
        return;
      }

      const focused = handlers.getFocusedTask();
      if (!focused) return;

      // 1-4 map to the four columns, in the order they are displayed.
      const columnIndex = Number.parseInt(event.key, 10) - 1;
      if (
        Number.isInteger(columnIndex) &&
        columnIndex >= 0 &&
        columnIndex < TASK_STATUSES.length
      ) {
        event.preventDefault();
        const status = TASK_STATUSES[columnIndex]!;
        if (status !== focused.status) handlers.onMoveFocused(focused, status);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handlers.onOpenFocused(focused);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        handlers.onDeleteFocused(focused);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers, enabled]);
}
