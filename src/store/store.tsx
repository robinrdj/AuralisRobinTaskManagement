import { configureStore } from "@reduxjs/toolkit";
import taskReducer from "./taskSlice.tsx";
import themeReducer from "./themeSlice.tsx";

export const store = configureStore({
  reducer: {
    tasks: taskReducer,
    theme: themeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
