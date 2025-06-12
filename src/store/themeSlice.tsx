import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define possible theme values
export type Theme = "light" | "dark";

// Initialize theme from localStorage or default to "light"
const initialState: Theme = (localStorage.getItem("theme") as Theme) || "light";

// Create a Redux slice for theme management
const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    // Toggle between light and dark themes
    toggleTheme: (state) => {
      const newTheme = state === "light" ? "dark" : "light";
      localStorage.setItem("theme", newTheme); // Persist theme to localStorage
      return newTheme;
    },
    // Set theme explicitly
    setTheme: (state, action: PayloadAction<Theme>) => {
      localStorage.setItem("theme", action.payload); // Persist theme to localStorage
      return action.payload;
    },
  },
});

// Export actions for use in components
export const { toggleTheme, setTheme } = themeSlice.actions;

// Export reducer to be used in the Redux store
export default themeSlice.reducer;
