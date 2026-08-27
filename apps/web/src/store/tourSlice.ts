import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const TOUR_KEY = "auralis:tour";

export interface TourState {
  /** Steps that have been shown at least once. */
  seen: string[];
  /** Steps the user actively dismissed; never shown again. */
  dismissed: string[];
  /** The guide is switched off entirely. */
  disabled: boolean;
  /** Statuses a card has been dragged into this session. */
  movedToStatuses: string[];
  visitedRoutes: string[];
  hasUsedFilters: boolean;
  hasOpenedCommandPalette: boolean;
  /** Timestamp of the last meaningful interaction, for idle detection. */
  lastActivityAt: number;
}

function readPersisted(): Pick<TourState, "seen" | "dismissed" | "disabled"> {
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    if (!raw) return { seen: [], dismissed: [], disabled: false };
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      seen: Array.isArray(parsed.seen) ? parsed.seen : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
      disabled: parsed.disabled === true,
    };
  } catch {
    // Corrupt or unavailable storage: start the tour fresh rather than crash.
    return { seen: [], dismissed: [], disabled: false };
  }
}

/**
 * `?tour=reset` clears saved progress so the first-run experience can be
 * replayed on demand — useful when demoing the app to someone.
 */
function shouldReset(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("tour") === "reset";
  } catch {
    return false;
  }
}

const persisted = shouldReset()
  ? { seen: [], dismissed: [], disabled: false }
  : readPersisted();

const initialState: TourState = {
  ...persisted,
  movedToStatuses: [],
  visitedRoutes: [],
  hasUsedFilters: false,
  hasOpenedCommandPalette: false,
  lastActivityAt: Date.now(),
};

const tourSlice = createSlice({
  name: "tour",
  initialState,
  reducers: {
    markStepSeen: (state, action: PayloadAction<string>) => {
      if (!state.seen.includes(action.payload)) state.seen.push(action.payload);
    },

    dismissStep: (state, action: PayloadAction<string>) => {
      if (!state.dismissed.includes(action.payload)) state.dismissed.push(action.payload);
      if (!state.seen.includes(action.payload)) state.seen.push(action.payload);
    },

    setTourDisabled: (state, action: PayloadAction<boolean>) => {
      state.disabled = action.payload;
    },

    resetTour: (state) => {
      state.seen = [];
      state.dismissed = [];
      state.disabled = false;
      state.movedToStatuses = [];
      state.hasUsedFilters = false;
      state.hasOpenedCommandPalette = false;
      state.lastActivityAt = Date.now();
    },

    recordMove: (state, action: PayloadAction<string>) => {
      if (!state.movedToStatuses.includes(action.payload)) {
        state.movedToStatuses.push(action.payload);
      }
      state.lastActivityAt = Date.now();
    },

    recordRouteVisit: (state, action: PayloadAction<string>) => {
      if (!state.visitedRoutes.includes(action.payload)) {
        state.visitedRoutes.push(action.payload);
      }
    },

    recordFilterUse: (state) => {
      state.hasUsedFilters = true;
      state.lastActivityAt = Date.now();
    },

    recordCommandPaletteUse: (state) => {
      state.hasOpenedCommandPalette = true;
      state.lastActivityAt = Date.now();
    },

    recordActivity: (state) => {
      state.lastActivityAt = Date.now();
    },
  },
});

export const {
  markStepSeen,
  dismissStep,
  setTourDisabled,
  resetTour,
  recordMove,
  recordRouteVisit,
  recordFilterUse,
  recordCommandPaletteUse,
  recordActivity,
} = tourSlice.actions;

export default tourSlice.reducer;

/** Only the durable parts are persisted; session facts are not. */
export function serialiseTourProgress(state: TourState): string {
  return JSON.stringify({
    seen: state.seen,
    dismissed: state.dismissed,
    disabled: state.disabled,
  });
}
