import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Lightweight top progress bar shown during route transitions.
 * Never blocks the UI with a full-screen splash.
 */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;
    if (isLoading) {
      // Only show the bar for transitions slower than 250ms — fast nav stays silent.
      showTimer = window.setTimeout(() => setVisible(true), 250);
    } else {
      hideTimer = window.setTimeout(() => setVisible(false), 120);
    }
    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [isLoading]);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-[var(--terracotta)]/15"
    >
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] bg-[var(--terracotta)]" />
      <style>{`@keyframes route-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
    </div>
  );
}
