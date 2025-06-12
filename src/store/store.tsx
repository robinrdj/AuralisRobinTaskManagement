import { configureStore } from "@reduxjs/toolkit";
import taskReducer from "./taskSlice";
import themeReducer from "./themeSlice";

/**
 * Configure the Redux store for the application.
 * Combines task and theme reducers.
 */
export const store = configureStore({
  reducer: {
    tasks: taskReducer, // Handles task-related state
    theme: themeReducer, // Handles theme (dark/light mode) state
  },
});

// Type for the root state of the Redux store
export type RootState = ReturnType<typeof store.getState>;

// Type for the Redux dispatch function
export type AppDispatch = typeof store.dispatch;
