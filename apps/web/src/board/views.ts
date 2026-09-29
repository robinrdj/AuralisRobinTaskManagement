import type { SavedView, ViewFilters } from "@auralis/shared";
import type { Filters, SortKey } from "@/store/uiSlice";

/**
 * Normalises filters so two that mean the same thing compare equal: order
 * within a list does not matter, and neither does whitespace around a search.
 */
function normalise(filters: ViewFilters | Filters): string {
  return JSON.stringify({
    search: filters.search.trim().toLowerCase(),
    priorities: [...filters.priorities].sort(),
    statuses: [...filters.statuses].sort(),
    assigneeIds: [...filters.assigneeIds].sort(),
    labelIds: [...filters.labelIds].sort(),
    dueFrom: filters.dueFrom,
    dueTo: filters.dueTo,
    overdueOnly: filters.overdueOnly,
  });
}

/** True when the board is showing exactly what a view describes. */
export function viewMatches(
  view: SavedView,
  filters: Filters,
  sortBy: SortKey,
  sortDirection: "asc" | "desc"
): boolean {
  return (
    view.sortBy === sortBy &&
    view.sortDirection === sortDirection &&
    normalise(view.filters) === normalise(filters)
  );
}
