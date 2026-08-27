import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { TaskPriority } from "@auralis/shared";
import { cx, PRIORITY_LABELS } from "./labels";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-[var(--shadow-card)]",
  secondary:
    "bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-hover)]",
  ghost:
    "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
  danger: "bg-[var(--danger)] text-white hover:brightness-110",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders as a square icon-only button, with the label as its accessible name. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", iconOnly = false, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cx(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        iconOnly ? SQUARE_SIZES[size] : BUTTON_SIZES[size],
        className
      )}
      {...props}
    />
  );
});

const SQUARE_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide"
      style={{
        color: `var(--priority-${priority})`,
        backgroundColor: `color-mix(in oklch, var(--priority-${priority}) 14%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `var(--priority-${priority})` }}
      />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border border-[var(--border-subtle)]",
        "bg-[var(--surface-raised)] shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    />
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[var(--text-muted)]">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * A shimmering placeholder matching the shape of what is loading. v1 skipped
 * these in favour of a spinner, which makes the layout jump when data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-hover)]",
        className
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon}
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>
      {action}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
