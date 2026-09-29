import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useLogoutMutation, type BoardSummary } from "@/store/api";
import type { PublicUser } from "@auralis/shared";
import { useTheme } from "@/hooks/useTheme";
import { useAppDispatch } from "@/store";
import { setCommandPaletteOpen } from "@/store/uiSlice";
import { Button } from "./ui/primitives";
import { cx } from "./ui/labels";
import { AuriSprite } from "@/tour/AuriSprite";
import { BoardSwitcher } from "./boards/BoardSwitcher";
import { NotificationBell } from "./NotificationBell";
import { RunningTimer } from "./RunningTimer";

const NAV_ITEMS = [
  { to: "/board", label: "Board", tour: "nav-board" },
  { to: "/calendar", label: "Calendar", tour: "nav-calendar" },
  { to: "/timeline", label: "Timeline", tour: "nav-timeline" },
  { to: "/analytics", label: "Analytics", tour: "nav-analytics" },
];

export function AppShell({
  user,
  boards,
  activeBoard,
  children,
}: {
  user: PublicUser;
  boards: BoardSummary[];
  activeBoard: BoardSummary;
  children: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme, cycleTheme } = useTheme();
  const [logout] = useLogoutMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-[var(--surface-sunken)]">
      {/* Skip link: the first tab stop on the page, for keyboard users. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-[var(--radius-control)] focus:bg-[var(--accent)] focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 md:px-6">
        <NavLink to="/board" className="flex items-center gap-2" aria-label="Task Manager home">
          <AuriSprite mood="idle" size={26} />
          <span className="hidden text-base font-semibold tracking-tight text-[var(--text-primary)] sm:inline">
            Task Manager
          </span>
        </NavLink>

        <BoardSwitcher boards={boards} activeBoard={activeBoard} userId={user.id} />

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-tour={item.tour}
              className={({ isActive }) =>
                cx(
                  "rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => dispatch(setCommandPaletteOpen(true))}
            className="hidden items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] sm:flex"
          >
            Search
            <kbd className="rounded border border-[var(--border-default)] px-1 py-0.5 text-2xs">
              Ctrl K
            </kbd>
          </button>

          <RunningTimer />

          <NotificationBell />

          <Button
            iconOnly
            variant="ghost"
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon theme={theme} />
          </Button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name.slice(0, 1).toUpperCase()}
              <span className="sr-only">Account menu for {user.name}</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-2 w-56 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1.5 shadow-[var(--shadow-overlay)]"
                >
                  <div className="border-b border-[var(--border-subtle)] px-2.5 py-2">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {user.isGuest ? "Guest session" : user.email}
                    </p>
                  </div>

                  {user.isGuest && (
                    <p className="px-2.5 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      This board is temporary. Create an account to keep it.
                    </p>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                      navigate("/");
                    }}
                    className="w-full rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    {user.isGuest ? "End session" : "Sign out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Bottom navigation on small screens, where a top nav bar competes with the board. */}
      <nav
        className="order-last flex shrink-0 items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--surface-base)] py-1.5 md:hidden"
        aria-label="Main"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                "rounded-[var(--radius-control)] px-4 py-1.5 text-xs font-medium",
                isActive ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]"
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === "dark") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (theme === "light") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
