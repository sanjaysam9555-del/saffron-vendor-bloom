import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import logo from "@/assets/saffron-events-loader.png";

/**
 * Pulsing Saffron logo shown briefly while a route transition is in flight.
 * Uses only `isLoading` (not the sticky `status === "pending"`) so it always
 * disappears once the new route has rendered.
 */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: number | undefined;
    let safety: number | undefined;
    if (isLoading) {
      // Debounce so instant transitions don't flash the loader.
      showTimer = window.setTimeout(() => setVisible(true), 120);
      // Safety net — never keep it on screen longer than 6s.
      safety = window.setTimeout(() => setVisible(false), 6000);
    } else {
      setVisible(false);
    }
    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (safety) window.clearTimeout(safety);
    };
  }, [isLoading]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed left-1/2 top-4 z-[100] -translate-x-1/2 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <img
        src={logo}
        alt=""
        className="h-14 w-auto"
        style={{ animation: visible ? "saffron-pulse 1.2s ease-in-out infinite" : "none" }}
      />
    </div>
  );
}
