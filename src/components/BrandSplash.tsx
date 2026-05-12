/**
 * Full-screen branded splash. Used everywhere we need to mask UI while
 * something is loading — route transitions, auth restoration, dashboards
 * fetching first paint data, and the iOS PWA cold boot.
 *
 * Cream background (matches the dashboard) with the Saffron wordmark in
 * terracotta. When `showLoading` is true, the wordmark gently pulses to
 * signal work in progress. Pass `showLoading={false}` for the opening
 * "splash plate" (PWA cold boot) where we don't want to imply work.
 */
export function BrandSplash({ showLoading = true }: { showLoading?: boolean }) {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--cream)]"
    >
      <div className="text-center">
        <p
          className={`font-display text-2xl tracking-wide text-[var(--terracotta)] sm:text-3xl ${
            showLoading ? "saffron-wordmark-pulse" : ""
          }`}
        >
          Saffron Planning Studio
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[var(--terracotta)]/70">
          Wedding & Event Planning
        </p>
      </div>
    </div>
  );
}
