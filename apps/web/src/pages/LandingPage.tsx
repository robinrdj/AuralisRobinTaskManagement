import { Link, useNavigate } from "react-router-dom";
import { useStartGuestSessionMutation } from "@/store/api";
import { Button } from "@/components/ui/primitives";
import { AuriSprite } from "@/tour/AuriSprite";
import { useTheme } from "@/hooks/useTheme";

/**
 * The front door.
 *
 * v1 opened straight onto an add-task form, which gave a visitor no idea what
 * they were looking at. The single most important control here is "Try it
 * without signing up" — nobody evaluating a portfolio project will create an
 * account, so the demo has to be one click and land on a populated board.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const { cycleTheme, theme } = useTheme();
  const [startGuest, { isLoading }] = useStartGuestSessionMutation();

  const tryDemo = async () => {
    try {
      await startGuest().unwrap();
      navigate("/board");
    } catch {
      navigate("/signup");
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--surface-sunken)]">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
        <AuriSprite mood="idle" size={28} />
        <span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          Task Manager
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cycleTheme} aria-label={`Theme: ${theme}`}>
            Theme
          </Button>
          <Link to="/signin">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 text-center md:py-24">
          {/* CSS rather than an animation library: this page is the first
              thing a visitor downloads, and a one-shot reveal does not justify
              shipping a 114KB dependency to render it. */}
          <div className="rise">
            <div className="mx-auto mb-6 flex justify-center">
              <AuriSprite mood="excited" size={72} />
            </div>

            <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text-primary)] md:text-5xl">
              A task board that keeps up with the room
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
              Drag work across columns and everyone watching sees it move. Every change is
              undoable, every date is honest, and nothing waits on a spinner.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" variant="primary" onClick={tryDemo} disabled={isLoading}>
                {isLoading ? "Setting up your board…" : "Try it — no signup"}
              </Button>
              <Link to="/signup">
                <Button size="lg" variant="secondary">
                  Create an account
                </Button>
              </Link>
            </div>

            <p className="mt-3 text-xs text-[var(--text-muted)]">
              The demo creates a temporary board with sample work already on it.
            </p>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="rise rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-card)]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                className="mb-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)]"
                style={{
                  backgroundColor: `color-mix(in oklch, ${feature.color} 16%, transparent)`,
                  color: feature.color,
                }}
                aria-hidden="true"
              >
                {feature.icon}
              </div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {feature.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-6">
        <p className="text-center text-xs text-[var(--text-muted)]">
          Built with React, Hono and Postgres.{" "}
          <a
            href="https://github.com/robinrdj/AuralisRobinTaskManagement"
            className="underline underline-offset-2 hover:text-[var(--text-secondary)]"
          >
            Source on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    title: "Live on every screen",
    description:
      "Moves, edits and deletions stream to everyone on the board over server-sent events. No refresh, no polling.",
    color: "var(--status-inprogress)",
    icon: <Dot />,
  },
  {
    title: "Undo actually undoes",
    description:
      "Changes apply instantly and roll back if the server disagrees. Every action offers a real compensating write.",
    color: "var(--status-completed)",
    icon: <Dot />,
  },
  {
    title: "Dates that sort correctly",
    description:
      "Calendar days stored as ISO, formatted in your locale at render. Overdue means overdue, in every timezone.",
    color: "var(--priority-high)",
    icon: <Dot />,
  },
  {
    title: "Keyboard first",
    description:
      "Ctrl-K opens anything. Cards lift and reorder from the keyboard alone, with a focus ring you cannot miss.",
    color: "var(--status-review)",
    icon: <Dot />,
  },
  {
    title: "Scales past the demo",
    description:
      "Columns virtualise above forty cards, and ordering uses fractional indices so a drag writes one row.",
    color: "var(--priority-medium)",
    icon: <Dot />,
  },
  {
    title: "A guide, not a wizard",
    description:
      "Auri watches what you do and speaks only when it helps. Always dismissible, never a five-step tour.",
    color: "var(--accent)",
    icon: <Dot />,
  },
];

function Dot() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4" fill="currentColor" />
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
    </svg>
  );
}
