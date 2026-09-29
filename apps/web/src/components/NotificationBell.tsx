import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { describeNotification, todayISO, type Notification } from "@auralis/shared";
import { useGetNotificationsQuery, useMarkNotificationsReadMutation } from "@/store/api";
import { useAppDispatch } from "@/store";
import { inspectTask, setActiveBoard } from "@/store/uiSlice";
import { formatRelativeTime } from "@/board/activityText";
import { cx } from "./ui/labels";

/**
 * The inbox in the header.
 *
 * New notifications arrive over the board's live connection; polling once a
 * minute covers pages without one and a connection that dropped. Opening an
 * entry switches to its board, opens the task, and marks it read.
 */
export function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const { data } = useGetNotificationsQuery(today, { pollingInterval: 60_000 });
  const [markRead] = useMarkNotificationsReadMutation();

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  const openEntry = (entry: Notification) => {
    setOpen(false);
    if (!entry.readAt) void markRead({ ids: [entry.id], today });
    if (!entry.boardId) return;
    dispatch(setActiveBoard(entry.boardId));
    navigate("/board");
    if (entry.taskId) dispatch(inspectTask(entry.taskId));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4 6.5a4 4 0 1 1 8 0c0 2.5.8 3.8 1.5 4.5h-11C3.2 10.3 4 9 4 6.5ZM6.5 13.5a1.6 1.6 0 0 0 3 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-semibold leading-none text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[54]" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Notifications"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            className="absolute right-0 z-[55] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void markRead({ today })}
                  className="text-xs text-[var(--accent-text)] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                You are all caught up.
              </p>
            ) : (
              <ul className="scrollbar-slim max-h-[min(24rem,60vh)] overflow-y-auto p-1">
                {notifications.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openEntry(entry)}
                      className="flex w-full gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left hover:bg-[var(--surface-hover)]"
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          entry.readAt ? "bg-transparent" : "bg-[var(--accent)]"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block text-sm leading-snug",
                            entry.readAt
                              ? "text-[var(--text-secondary)]"
                              : "font-medium text-[var(--text-primary)]"
                          )}
                        >
                          {describeNotification(entry)}
                          {!entry.readAt && <span className="sr-only"> (unread)</span>}
                        </span>
                        <span className="mt-0.5 block text-2xs text-[var(--text-muted)]">
                          {formatRelativeTime(entry.createdAt)}
                          {entry.boardName && ` · ${entry.boardName}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
