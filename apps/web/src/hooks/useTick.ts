import { useEffect, useState } from "react";

/** The current time, refreshed every second while `active`, so a running timer visibly ticks. */
export function useTick(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}
