import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "@/store";
import { consumeUndo, dismissToast, type Toast } from "@/store/toastSlice";
import { cx } from "./ui/labels";

const TONE_STYLES: Record<Toast["tone"], string> = {
  info: "border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-primary)]",
  success: "border-[var(--success)] bg-[var(--success-subtle)] text-[var(--text-primary)]",
  warning: "border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--text-primary)]",
  danger: "border-[var(--danger)] bg-[var(--danger-subtle)] text-[var(--text-primary)]",
};

export function ToastViewport() {
  const toasts = useAppSelector((state) => state.toasts.toasts);

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:left-4 sm:translate-x-0 sm:px-0"
      // Assertive: an undo offer is time-limited, so it has to interrupt.
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastRow({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch(dismissToast(toast.id));
    }, toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dispatch]);

  const undo = () => {
    if (!toast.undoToken) return;
    const handler = consumeUndo(toast.undoToken);
    dispatch(dismissToast(toast.id));
    void handler?.();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role="status"
      aria-live="polite"
      className={cx(
        "pointer-events-auto flex items-center gap-3 rounded-[var(--radius-card)] border px-3 py-2.5 shadow-[var(--shadow-overlay)]",
        TONE_STYLES[toast.tone]
      )}
    >
      <p className="min-w-0 flex-1 text-sm">{toast.message}</p>

      {toast.undoToken && (
        <button
          type="button"
          onClick={undo}
          className="shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold text-[var(--accent-text)] underline-offset-2 hover:bg-[var(--surface-hover)] hover:underline"
        >
          Undo
        </button>
      )}

      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        aria-label="Dismiss notification"
        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </motion.div>
  );
}
