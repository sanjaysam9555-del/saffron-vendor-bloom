import logo from "@/assets/saffron-events-loader.png";

/**
 * Full-screen branded splash. Used everywhere we need to mask UI while
 * something is loading — route transitions, auth restoration, dashboards
 * fetching first paint data, and the iOS PWA cold boot.
 *
 * Cream background (matches the dashboard) with the Saffron logo +
 * wordmark in terracotta, gently pulsing. Pass `showLoading={false}` for
 * the opening "splash plate" (PWA cold boot) where we don't want to imply
 * work in progress; default shows a "Loading…" hint for in-app waits.
 */
export function BrandSplash({ showLoading = true }: { showLoading?: boolean }) {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--cream)]"
    >
      <img
        src={logo}
        alt=""
        className="h-32 w-auto sm:h-40"
        style={{ animation: "saffron-pulse 2s ease-in-out infinite" }}
      />
      <div className="mt-6 text-center">
        <p className="font-display text-2xl tracking-wide text-[var(--terracotta)] sm:text-3xl">
          Saffron Planning Studio
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[var(--terracotta)]/70">
          Wedding & Event Planning
        </p>
        {showLoading && (
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]/80">
            Loading…
          </p>
        )}
      </div>
    </div>
  );
}
