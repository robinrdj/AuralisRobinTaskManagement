import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TaskPriority, TaskStatus } from "@auralis/shared";

export type ThemePreference = "light" | "dark" | "system";
export type SortKey = "position" | "dueDate" | "priority" | "title" | "createdAt";

export interface Filters {
  search: string;
  priorities: TaskPriority[];
  statuses: TaskStatus[];
  assigneeIds: string[];
  dueFrom: string | null;
  dueTo: string | null;
  /** Show only tasks past their due date and not yet complete. */
  overdueOnly: boolean;
}

export interface UiState {
  theme: ThemePreference;
  filters: Filters;
  sortBy: SortKey;
  sortDirection: "asc" | "desc";
  selectedIds: string[];
  selectionMode: boolean;
  commandPaletteOpen: boolean;
  /** Task whose detail panel is open, or null. */
  inspectedTaskId: string | null;
  /**
   * Bumped whenever something outside the board asks for the new-task form.
   * A counter rather than a boolean, so two consecutive requests are two
   * distinct values and the board reacts to the second one.
   */
  composeRequest: number;
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  priorities: [],
  statuses: [],
  assigneeIds: [],
  dueFrom: null,
  dueTo: null,
  overdueOnly: false,
};

const THEME_KEY = "auralis:theme";

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private browsing or blocked storage: the system preference is a fine default.
  }
  return "system";
}

const initialState: UiState = {
  theme: readStoredTheme(),
  filters: EMPTY_FILTERS,
  sortBy: "position",
  sortDirection: "asc",
  selectedIds: [],
  selectionMode: false,
  commandPaletteOpen: false,
  inspectedTaskId: null,
  composeRequest: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemePreference>) => {
      state.theme = action.payload;
    },

    /** Merges a partial change into the active filters. */
    setFilters: (state, action: PayloadAction<Partial<Filters>>) => {
      Object.assign(state.filters, action.payload);
    },

    /**
     * v1 could only clear a date range by disabling the whole filter bar,
     * which then hid the controls. Resetting is its own action now.
     */
    clearFilters: (state) => {
      state.filters = { ...EMPTY_FILTERS };
    },

    setSort: (state, action: PayloadAction<{ by: SortKey; direction?: "asc" | "desc" }>) => {
      state.sortBy = action.payload.by;
      state.sortDirection = action.payload.direction ?? "asc";
    },

    toggleSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedIds.indexOf(action.payload);
      if (index >= 0) state.selectedIds.splice(index, 1);
      else state.selectedIds.push(action.payload);
      state.selectionMode = state.selectedIds.length > 0;
    },

    selectMany: (state, action: PayloadAction<string[]>) => {
      state.selectedIds = [...new Set([...state.selectedIds, ...action.payload])];
      state.selectionMode = state.selectedIds.length > 0;
    },

    clearSelection: (state) => {
      state.selectedIds = [];
      state.selectionMode = false;
    },

    setSelectionMode: (state, action: PayloadAction<boolean>) => {
      state.selectionMode = action.payload;
      if (!action.payload) state.selectedIds = [];
    },

    setCommandPaletteOpen: (state, action: PayloadAction<boolean>) => {
      state.commandPaletteOpen = action.payload;
    },

    inspectTask: (state, action: PayloadAction<string | null>) => {
      state.inspectedTaskId = action.payload;
    },

    /** Asks the board to open its new-task form, from anywhere in the app. */
    requestCompose: (state) => {
      state.composeRequest += 1;
    },
  },
});

export const {
  setTheme,
  setFilters,
  clearFilters,
  setSort,
  toggleSelection,
  selectMany,
  clearSelection,
  setSelectionMode,
  setCommandPaletteOpen,
  inspectTask,
  requestCompose,
} = uiSlice.actions;

export default uiSlice.reducer;

/** True when anything is narrowing the board, so the UI can offer a reset. */
export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.dueFrom !== null ||
    filters.dueTo !== null ||
    filters.overdueOnly
  );
}

export { THEME_KEY };
