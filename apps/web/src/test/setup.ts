import "@testing-library/jest-dom/vitest";
import { MotionGlobalConfig } from "motion/react";

/**
 * Run animations instantly under test.
 *
 * `AnimatePresence` keeps an exiting element mounted until its exit animation
 * finishes, and that animation is driven by requestAnimationFrame — which fake
 * timers do not advance. Without this, every "the toast goes away" assertion
 * fails on an element that is visually gone but still in the DOM.
 */
MotionGlobalConfig.skipAnimations = true;

/**
 * jsdom implements neither of these, and both are used by the board — the
 * virtualiser measures rows with ResizeObserver, and the theme hook reads the
 * colour-scheme media query.
 */
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
