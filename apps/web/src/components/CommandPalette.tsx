import { useEffect, useMemo } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@auralis/shared";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  clearFilters,
  inspectTask,
  setActiveBoard,
  setCommandPaletteOpen,
  setFilters,
} from "@/store/uiSlice";
import type { BoardSummary } from "@/store/api";
import { recordCommandPaletteUse } from "@/store/tourSlice";
import { useTheme } from "@/hooks/useTheme";
import { PRIORITY_LABELS, STATUS_LABELS } from "./ui/labels";

/**
 * Ctrl/Cmd-K to do anything without reaching for the mouse.
 *
 * The palette searches tasks as well as commands, so it doubles as navigation
 * on a large board. Registering the shortcut on `document` in the capture
 * phase means it works from inside inputs too, where a bubbling listener would
 * be swallowed.
 */
export function CommandPalette({
  tasks,
  boards = [],
  activeBoardId,
  onNewTask,
}: {
  tasks: Task[];
  boards?: BoardSummary[];
  activeBoardId?: string;
  onNewTask: () => void;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { cycleTheme } = useTheme();
  const open = useAppSelector((state) => state.ui.commandPaletteOpen);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        dispatch(setCommandPaletteOpen(!open));
        dispatch(recordCommandPaletteUse());
        return;
      }

      // cmdk only handles Escape for itself inside `Command.Dialog`; this
      // palette supplies its own overlay, so it has to close itself.
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(setCommandPaletteOpen(false));
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [dispatch, open]);

  const close = () => dispatch(setCommandPaletteOpen(false));

  const run = (action: () => void) => {
    action();
    close();
  };

  // Only the first handful of matches are worth rendering; cmdk filters the
  // rest and a palette listing 400 tasks helps nobody.
  const searchableTasks = useMemo(() => tasks.slice(0, 200), [tasks]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)]"
          >
            <Command label="Command palette" loop>
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  className="text-[var(--text-muted)]"
                >
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M11 11l3 3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <Command.Input
                  autoFocus
                  placeholder="Search tasks or run a command…"
                  className="h-12 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
                <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 text-2xs text-[var(--text-muted)]">
                  Esc
                </kbd>
              </div>

              <Command.List className="scrollbar-slim max-h-[min(24rem,60vh)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                  Nothing matches that.
                </Command.Empty>

                <Group heading="Actions">
                  <Item onSelect={() => run(onNewTask)} shortcut="N">
                    Create a task
                  </Item>
                  <Item onSelect={() => run(() => navigate("/board"))}>Go to board</Item>
                  <Item onSelect={() => run(() => navigate("/analytics"))}>
                    Go to analytics
                  </Item>
                  <Item onSelect={() => run(cycleTheme)}>Switch theme</Item>
                  <Item onSelect={() => run(() => dispatch(clearFilters()))}>
                    Clear all filters
                  </Item>
                </Group>

                {boards.length > 1 && (
                  <Group heading="Switch board">
                    {boards
                      .filter((board) => board.id !== activeBoardId)
                      .map((board) => (
                        <Item
                          key={board.id}
                          value={`board ${board.name}`}
                          onSelect={() =>
                            run(() => {
                              dispatch(setActiveBoard(board.id));
                              navigate("/board");
                            })
                          }
                        >
                          Open board "{board.name}"
                        </Item>
                      ))}
                  </Group>
                )}

                <Group heading="Filter by status">
                  {TASK_STATUSES.map((status) => (
                    <Item
                      key={status}
                      onSelect={() => run(() => dispatch(setFilters({ statuses: [status] })))}
                    >
                      Show only {STATUS_LABELS[status].toLowerCase()}
                    </Item>
                  ))}
                  <Item onSelect={() => run(() => dispatch(setFilters({ overdueOnly: true })))}>
                    Show only overdue
                  </Item>
                </Group>

                <Group heading="Filter by priority">
                  {TASK_PRIORITIES.map((priority) => (
                    <Item
                      key={priority}
                      onSelect={() =>
                        run(() => dispatch(setFilters({ priorities: [priority] })))
                      }
                    >
                      Show only {PRIORITY_LABELS[priority].toLowerCase()} priority
                    </Item>
                  ))}
                </Group>

                {searchableTasks.length > 0 && (
                  <Group heading="Tasks">
                    {searchableTasks.map((task) => (
                      <Item
                        key={task.id}
                        value={`${task.title} ${task.description}`}
                        onSelect={() => run(() => dispatch(inspectTask(task.id)))}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: `var(--priority-${task.priority})` }}
                        />
                        <span className="min-w-0 flex-1 truncate">{task.title}</span>
                        <span className="shrink-0 text-2xs text-[var(--text-muted)]">
                          {STATUS_LABELS[task.status]}
                        </span>
                      </Item>
                    ))}
                  </Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-muted)]"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  children,
  onSelect,
  value,
  shortcut,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  value?: string;
  shortcut?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm text-[var(--text-primary)] data-[selected=true]:bg-[var(--accent-subtle)] data-[selected=true]:text-[var(--accent-text)]"
    >
      {children}
      {shortcut && (
        <kbd className="ml-auto rounded border border-[var(--border-default)] px-1.5 py-0.5 text-2xs text-[var(--text-muted)]">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
