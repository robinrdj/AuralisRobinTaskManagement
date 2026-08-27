import { useEffect, useState } from "react";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Tracks the on-screen box of the element a tour step points at.
 *
 * The target may not exist yet when the step becomes active — the board is
 * still loading, or the element is inside a panel that has not opened. Rather
 * than measuring once and giving up, this polls briefly for the element to
 * appear, then follows it through scrolls, resizes and layout changes for as
 * long as the step is showing.
 */
export function useSpotlight(selector: string | null, padding = 8): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    let frame = 0;
    let attempts = 0;
    let element: Element | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      if (!element) return;
      const box = element.getBoundingClientRect();

      // A zero-sized box means the element is display:none or not laid out yet.
      if (box.width === 0 && box.height === 0) {
        setRect(null);
        return;
      }

      setRect({
        top: box.top - padding,
        left: box.left - padding,
        width: box.width + padding * 2,
        height: box.height + padding * 2,
      });
    };

    /** Retries for about two seconds before concluding the target is absent. */
    const findTarget = () => {
      element = document.querySelector(selector);
      if (element) {
        measure();
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(element);
        return;
      }
      if (attempts++ < 40) {
        frame = window.setTimeout(findTarget, 50);
      } else {
        setRect(null);
      }
    };

    findTarget();

    // `true` captures scroll on any ancestor, not just the window — the board
    // columns scroll independently.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      window.clearTimeout(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [selector, padding]);

  return rect;
}
