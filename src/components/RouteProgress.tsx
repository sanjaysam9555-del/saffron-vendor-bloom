import { useRouterState } from "@tanstack/react-router";

/**
 * Thin top-of-screen progress bar that appears whenever a route is loading.
 * Gives instant visual feedback after a click even before data arrives.
 */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[2px] origin-left bg-[var(--terracotta)] transition-opacity duration-200 ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
      style={{
        animation: isLoading ? "route-progress 1.4s ease-in-out infinite" : "none",
      }}
    />
  );
}
