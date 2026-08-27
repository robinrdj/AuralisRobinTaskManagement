import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLoginMutation, useSignupMutation, useStartGuestSessionMutation } from "@/store/api";
import { Button } from "@/components/ui/primitives";
import { cx } from "@/components/ui/labels";
import { AuriSprite } from "@/tour/AuriSprite";

/**
 * Sign in and sign up, sharing one form.
 *
 * Server errors are surfaced verbatim where they are safe to show — the API
 * deliberately returns the same message for an unknown email as for a wrong
 * password, so echoing it cannot leak which accounts exist.
 */
export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const [login, loginState] = useLoginMutation();
  const [signup, signupState] = useSignupMutation();
  const [startGuest, guestState] = useStartGuestSessionMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const busy = loginState.isLoading || signupState.isLoading || guestState.isLoading;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isSignup && password.length < 12) {
      setError("Use at least 12 characters — length matters more than symbols.");
      return;
    }

    try {
      if (isSignup)
        await signup({ email, password, name: name || email.split("@")[0]! }).unwrap();
      else await login({ email, password }).unwrap();
      navigate("/board");
    } catch (err) {
      setError(readApiError(err) ?? "Something went wrong. Try again.");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--surface-sunken)] px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <AuriSprite mood="idle" size={32} />
          <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Auralis
          </span>
        </Link>

        <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-raised)]">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {isSignup
              ? "Your board is ready the moment you sign up."
              : "Sign in to your board."}
          </p>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3.5">
            {isSignup && (
              <Field label="Name" htmlFor="auth-name">
                <input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="What should we call you?"
                  className={INPUT_CLASS}
                />
              </Field>
            )}

            <Field label="Email" htmlFor="auth-email">
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="auth-password"
              hint={isSignup ? "At least 12 characters" : undefined}
            >
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                className={INPUT_CLASS}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={busy} className="mt-1">
              {busy ? "Just a moment…" : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="text-2xs uppercase tracking-wide text-[var(--text-muted)]">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              try {
                await startGuest().unwrap();
                navigate("/board");
              } catch {
                setError("Could not start a demo session. Try again.");
              }
            }}
          >
            Try the demo instead
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link
            to={isSignup ? "/signin" : "/signup"}
            className="font-medium text-[var(--accent-text)] underline-offset-2 hover:underline"
          >
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className={cx(
          "flex items-baseline justify-between text-xs font-medium text-[var(--text-secondary)]"
        )}
      >
        {label}
        {hint && <span className="text-2xs font-normal text-[var(--text-muted)]">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** Pulls the API's error message out of an RTK Query rejection. */
function readApiError(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
