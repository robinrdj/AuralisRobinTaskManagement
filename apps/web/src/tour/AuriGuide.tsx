import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { isOverdue, type Task } from "@auralis/shared";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  dismissStep,
  markStepSeen,
  recordActivity,
  recordCommandPaletteUse,
  recordRouteVisit,
  setTourDisabled,
} from "@/store/tourSlice";
import { setCommandPaletteOpen } from "@/store/uiSlice";
import { selectStep, type TourFacts, type TourStep } from "./steps";
import { AuriSprite } from "./AuriSprite";
import { useSpotlight } from "./useSpotlight";
import { Button } from "@/components/ui/primitives";
import { cx } from "@/components/ui/labels";

export interface AuriGuideProps {
  tasks: Task[];
  onSeedSamples: () => void;
}

/**
 * Auri's home in the app.
 *
 * Auri watches the board and speaks only when a step's predicate holds. The
 * guide is always dismissible, remembers every dismissal, and never blocks
 * what is underneath it — the spotlight overlay is click-through except for
 * the bubble itself, so a user who ignores Auri can carry on working.
 */
export function AuriGuide({ tasks, onSeedSamples }: AuriGuideProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const tour = useAppSelector((state) => state.tour);
  const [idleMs, setIdleMs] = useState(0);

  // Idle time drives one step, so it is polled rather than derived — but at a
  // coarse interval, because nothing here needs sub-second accuracy.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIdleMs(Date.now() - tour.lastActivityAt);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [tour.lastActivityAt]);

  useEffect(() => {
    dispatch(recordRouteVisit(location.pathname));
  }, [dispatch, location.pathname]);

  // Any interaction anywhere resets the idle clock.
  useEffect(() => {
    const onInteract = () => dispatch(recordActivity());
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, [dispatch]);

  const facts = useMemo<TourFacts>(() => {
    const now = new Date();
    return {
      taskCount: tasks.length,
      tasks,
      movedToStatuses: new Set(tour.movedToStatuses),
      visitedRoutes: new Set(tour.visitedRoutes),
      currentRoute: location.pathname,
      hasUsedFilters: tour.hasUsedFilters,
      hasOpenedCommandPalette: tour.hasOpenedCommandPalette,
      idleMs,
      overdueCount: tasks.filter((task) => isOverdue(task, now)).length,
      completedCount: tasks.filter((task) => task.status === "completed").length,
    };
  }, [tasks, tour, location.pathname, idleMs]);

  const step = useMemo(() => {
    if (tour.disabled) return null;
    return selectStep(facts, new Set(tour.seen), new Set(tour.dismissed));
  }, [facts, tour.disabled, tour.seen, tour.dismissed]);

  // Mark a step seen once it has actually been on screen for a moment, so a
  // step that flashes past during a state change is not silently burned.
  const seenTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(seenTimer.current);
    if (!step) return;
    seenTimer.current = window.setTimeout(() => {
      dispatch(markStepSeen(step.id));
    }, 1_200);
    return () => window.clearTimeout(seenTimer.current);
  }, [step, dispatch]);

  const runAction = useCallback(
    (action: NonNullable<TourStep["action"]>) => {
      switch (action.kind) {
        case "seed-samples":
          onSeedSamples();
          break;
        case "open-palette":
          dispatch(setCommandPaletteOpen(true));
          dispatch(recordCommandPaletteUse());
          break;
        case "goto-analytics":
          navigate("/analytics");
          break;
      }
      if (step) dispatch(markStepSeen(step.id));
    },
    [dispatch, navigate, onSeedSamples, step]
  );

  return (
    <>
      <Spotlight step={step} />
      <AnimatePresence mode="wait">
        {step && (
          <AuriBubble
            key={step.id}
            step={step}
            onDismiss={() => dispatch(dismissStep(step.id))}
            onDisable={() => dispatch(setTourDisabled(true))}
            onAction={runAction}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Dims the page except for the step's target.
 *
 * Drawn as a single SVG path with an even-odd fill rule: the outer rectangle
 * covers the viewport and the inner rounded rect punches a hole in it. One
 * element, one paint, and it animates smoothly as the target moves.
 */
function Spotlight({ step }: { step: TourStep | null }) {
  const rect = useSpotlight(step?.target ?? null);

  return (
    <AnimatePresence>
      {rect && (
        <motion.svg
          key="spotlight"
          className="pointer-events-none fixed inset-0 z-40 h-full w-full"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.path
            fillRule="evenodd"
            fill="oklch(20% 0.02 265 / 0.45)"
            initial={false}
            animate={{
              d: cutoutPath(rect.left, rect.top, rect.width, rect.height, 12),
            }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          />
          <motion.rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx={12}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.9, 0.35, 0.9] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

/** Viewport rectangle with a rounded hole cut out of it. */
function cutoutPath(x: number, y: number, w: number, h: number, r: number): string {
  const vw = typeof window === "undefined" ? 1920 : window.innerWidth;
  const vh = typeof window === "undefined" ? 1080 : window.innerHeight;
  const radius = Math.min(r, w / 2, h / 2);

  return [
    `M0,0 H${vw} V${vh} H0 Z`,
    `M${x + radius},${y}`,
    `H${x + w - radius}`,
    `A${radius},${radius} 0 0 1 ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `A${radius},${radius} 0 0 1 ${x + w - radius},${y + h}`,
    `H${x + radius}`,
    `A${radius},${radius} 0 0 1 ${x},${y + h - radius}`,
    `V${y + radius}`,
    `A${radius},${radius} 0 0 1 ${x + radius},${y}`,
    "Z",
  ].join(" ");
}

function AuriBubble({
  step,
  onDismiss,
  onDisable,
  onAction,
}: {
  step: TourStep;
  onDismiss: () => void;
  onDisable: () => void;
  onAction: (action: NonNullable<TourStep["action"]>) => void;
}) {
  const rect = useSpotlight(step.target);
  const position = bubblePosition(step, rect);

  return (
    <motion.div
      className="fixed z-50 max-w-[min(20rem,calc(100vw-2rem))]"
      style={position}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      /*
       * A polite live region: a screen reader finishes what it is saying
       * before announcing Auri, so guidance never interrupts the user's own
       * navigation. `role="status"` carries the same politeness in older ATs.
       */
      role="status"
      aria-live="polite"
    >
      <div
        className={cx(
          "flex items-start gap-3 rounded-[var(--radius-card)] p-3 pr-2.5",
          "border border-[var(--border-default)] bg-[var(--surface-overlay)]",
          "shadow-[var(--shadow-overlay)] backdrop-blur-sm"
        )}
      >
        <div className="-mt-1 -ml-1 shrink-0">
          <AuriSprite mood={step.mood} size={40} />
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm leading-snug text-[var(--text-primary)]">{step.message}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {step.action && (
              <Button size="sm" variant="primary" onClick={() => onAction(step.action!)}>
                {step.action.label}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Got it
            </Button>
            <button
              type="button"
              onClick={onDisable}
              className="ml-auto text-2xs text-[var(--text-muted)] underline-offset-2 hover:underline"
            >
              Turn off tips
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Places the bubble beside its target, clamped to stay on screen. With no
 * target it sits in the lower-right, out of the way of the board.
 */
function bubblePosition(step: TourStep, rect: ReturnType<typeof useSpotlight>) {
  const margin = 12;
  const width = 320;

  if (!rect || step.placement === "center") {
    return { right: "1.5rem", bottom: "1.5rem" } as const;
  }

  const vw = typeof window === "undefined" ? 1920 : window.innerWidth;
  const vh = typeof window === "undefined" ? 1080 : window.innerHeight;
  const clampLeft = (value: number) => Math.max(margin, Math.min(value, vw - width - margin));

  switch (step.placement) {
    case "top":
      return { left: clampLeft(rect.left), top: Math.max(margin, rect.top - 116) };
    case "left":
      return {
        left: clampLeft(rect.left - width - margin),
        top: Math.min(rect.top, vh - 160),
      };
    case "right":
      return {
        left: clampLeft(rect.left + rect.width + margin),
        top: Math.min(rect.top, vh - 160),
      };
    case "bottom":
    default:
      return {
        left: clampLeft(rect.left),
        top: Math.min(rect.top + rect.height + margin, vh - 160),
      };
  }
}
