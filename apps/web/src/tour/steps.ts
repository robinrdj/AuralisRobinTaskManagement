import type { Task } from "@auralis/shared";

/**
 * The onboarding engine.
 *
 * Auri is not a scripted sequence of "next" buttons. Each step declares a
 * predicate over the live board, and the engine shows the highest-priority
 * step whose predicate currently holds and which the user has not already
 * seen or dismissed. That means the guidance tracks what the person is
 * actually doing: create a task and the "create a task" step stops applying
 * on its own, without anything having to advance a cursor.
 */

export interface TourFacts {
  taskCount: number;
  tasks: Task[];
  /** Statuses the user has moved a card into during this session. */
  movedToStatuses: Set<string>;
  visitedRoutes: Set<string>;
  currentRoute: string;
  hasUsedFilters: boolean;
  hasOpenedCommandPalette: boolean;
  /** Milliseconds since the user last did anything. */
  idleMs: number;
  overdueCount: number;
  completedCount: number;
}

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  /** Higher wins when several steps apply at once. */
  priority: number;
  /** CSS selector for the element to spotlight, or null for a centred bubble. */
  target: string | null;
  placement: TourPlacement;
  message: string;
  /** Optional one-click action offered alongside the message. */
  action?: { label: string; kind: "seed-samples" | "open-palette" | "goto-analytics" };
  /** Auri's expression, which drives the sprite's animation. */
  mood: "idle" | "excited" | "pointing" | "concerned" | "celebrating";
  /** Shown only while this holds. */
  applies: (facts: TourFacts) => boolean;
  /**
   * When true, the step is not re-shown once seen. Steps that describe a
   * transient condition (overdue work) are allowed to return.
   */
  once: boolean;
}

/** Keep messages under about a dozen words — this is a nudge, not a manual. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome-empty",
    priority: 100,
    target: '[data-tour="new-task"]',
    placement: "bottom",
    message: "Nothing here yet. Let's make your first task.",
    mood: "excited",
    once: true,
    applies: (facts) => facts.taskCount === 0 && facts.currentRoute === "/board",
  },
  {
    id: "offer-samples",
    priority: 95,
    target: null,
    placement: "center",
    message: "Want a board with some tasks already on it?",
    action: { label: "Fill it in", kind: "seed-samples" },
    mood: "idle",
    once: true,
    // Only after they have had a moment to look around and not acted.
    applies: (facts) =>
      facts.taskCount === 0 && facts.idleMs > 25_000 && facts.currentRoute === "/board",
  },
  {
    id: "first-task-created",
    priority: 90,
    target: '[data-tour="column-inprogress"]',
    placement: "left",
    message: "Drag it here when you start working on it.",
    mood: "pointing",
    once: true,
    applies: (facts) => facts.taskCount >= 1 && facts.movedToStatuses.size === 0,
  },
  {
    id: "first-move",
    priority: 80,
    target: '[data-tour="filter-bar"]',
    placement: "bottom",
    message: "That's the board. Filters help once it fills up.",
    mood: "idle",
    once: true,
    applies: (facts) => facts.movedToStatuses.size >= 1 && !facts.hasUsedFilters,
  },
  {
    id: "try-command-palette",
    priority: 70,
    target: null,
    placement: "center",
    message: "Press Ctrl-K to jump anywhere without the mouse.",
    action: { label: "Show me", kind: "open-palette" },
    mood: "idle",
    once: true,
    applies: (facts) => facts.taskCount >= 3 && !facts.hasOpenedCommandPalette,
  },
  {
    id: "overdue-warning",
    priority: 85,
    target: '[data-tour="filter-overdue"]',
    placement: "bottom",
    message: "Some work has slipped past its due date.",
    mood: "concerned",
    once: false,
    applies: (facts) => facts.overdueCount >= 2 && facts.currentRoute === "/board",
  },
  {
    id: "discover-analytics",
    priority: 60,
    target: '[data-tour="nav-analytics"]',
    placement: "bottom",
    message: "Curious how you're doing? The charts know.",
    action: { label: "Take a look", kind: "goto-analytics" },
    mood: "pointing",
    once: true,
    applies: (facts) => facts.taskCount >= 4 && !facts.visitedRoutes.has("/analytics"),
  },
  {
    id: "all-done",
    priority: 50,
    target: null,
    placement: "center",
    message: "Every task done. That's the whole board clear.",
    mood: "celebrating",
    once: true,
    applies: (facts) => facts.taskCount >= 3 && facts.completedCount === facts.taskCount,
  },
];

/**
 * Picks the step to show, or null for none.
 *
 * `seen` holds the ids the user has already been shown or dismissed; steps
 * marked `once: false` are exempt so a recurring condition can speak up again.
 */
export function selectStep(
  facts: TourFacts,
  seen: ReadonlySet<string>,
  dismissedIds: ReadonlySet<string>
): TourStep | null {
  const candidates = TOUR_STEPS.filter((step) => {
    if (dismissedIds.has(step.id)) return false;
    if (step.once && seen.has(step.id)) return false;
    return step.applies(facts);
  });

  if (candidates.length === 0) return null;
  return candidates.reduce((best, step) => (step.priority > best.priority ? step : best));
}
