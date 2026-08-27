import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useDispatch, useSelector, useStore } from "react-redux";
import { api } from "./api";
import uiReducer, { THEME_KEY } from "./uiSlice";
import toastReducer from "./toastSlice";
import tourReducer, { TOUR_KEY, serialiseTourProgress } from "./tourSlice";

export function createStore() {
  const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      ui: uiReducer,
      toasts: toastReducer,
      tour: tourReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // RTK Query holds AbortSignals and Errors in its own internal actions.
          ignoredActions: [`${api.reducerPath}/executeQuery/rejected`],
        },
      }).concat(api.middleware),
  });

  // Refetch on reconnect and on window focus.
  setupListeners(store.dispatch);
  return store;
}

export const store = createStore();

/**
 * Persist the two preferences worth remembering across visits.
 *
 * Subscribing here rather than writing inside reducers keeps the reducers
 * pure — v1 called `localStorage.setItem` inside every task reducer, which
 * made them side-effecting and untestable.
 */
let lastTheme: string | undefined;
let lastTourProgress: string | undefined;

store.subscribe(() => {
  const state = store.getState();

  if (state.ui.theme !== lastTheme) {
    lastTheme = state.ui.theme;
    try {
      localStorage.setItem(THEME_KEY, state.ui.theme);
    } catch {
      // Storage unavailable; the preference simply will not survive a reload.
    }
  }

  const progress = serialiseTourProgress(state.tour);
  if (progress !== lastTourProgress) {
    lastTourProgress = progress;
    try {
      localStorage.setItem(TOUR_KEY, progress);
    } catch {
      // As above.
    }
  }
});

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
