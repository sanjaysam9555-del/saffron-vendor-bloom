import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { BrandSplash } from "./BrandSplash";

/**
 * Full-screen branded splash shown while a route transition is in flight.
 * Debounced so instant transitions don't flash, with a 6s safety timeout.
 */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: number | undefined;
    let safety: number | undefined;
    if (isLoading) {
      showTimer = window.setTimeout(() => setVisible(true), 120);
      safety = window.setTimeout(() => setVisible(false), 6000);
    } else {
      setVisible(false);
    }
    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (safety) window.clearTimeout(safety);
    };
  }, [isLoading]);

  if (!visible) return null;
  return <BrandSplash />;
}
