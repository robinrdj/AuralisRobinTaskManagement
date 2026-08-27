import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { setTheme, type ThemePreference } from "@/store/uiSlice";

/**
 * Reflects the theme preference onto the document root.
 *
 * "system" removes the attribute entirely rather than resolving it to a value,
 * which lets the CSS `prefers-color-scheme` media query stay in charge — so a
 * user who changes their OS theme sees the app follow immediately, with no
 * reload and no listener.
 */
export function useTheme() {
  const theme = useAppSelector((state) => state.ui.theme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  return {
    theme,
    setTheme: (next: ThemePreference) => dispatch(setTheme(next)),
    /** Cycles light → dark → system, so the toggle can reach all three. */
    cycleTheme: () => {
      const order: ThemePreference[] = ["light", "dark", "system"];
      const next = order[(order.indexOf(theme) + 1) % order.length]!;
      dispatch(setTheme(next));
    },
  };
}
