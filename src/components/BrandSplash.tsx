/**
 * Full-screen branded splash. Used everywhere we need to mask UI while
 * something is loading — route transitions, auth restoration, dashboards
 * fetching first paint data, and the iOS PWA cold boot.
 *
 * Cream background (matches the dashboard) with the Saffron wordmark in
 * terracotta. When `showLoading` is true, a "Loading" label appears with
 * four dots that cycle one-at-a-time in a circuit. Pass `showLoading={false}`
 * for the opening "splash plate" (PWA cold boot) where we don't want to
 * imply work in progress.
 */
export function BrandSplash({ showLoading = true }: { showLoading?: boolean }) {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--cream)]"
    >
      <div className="text-center">
        <p className="font-display text-2xl tracking-wide text-[var(--terracotta)] sm:text-3xl">
          Saffron Planning Studio
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[var(--terracotta)]/70">
          Wedding & Event Planning
        </p>
        {showLoading && (
          <p className="mt-8 inline-flex items-center justify-center text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]/80">
            <span>Loading</span>
            <span className="ml-0.5 inline-flex">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="text-[var(--terracotta)]"
                  style={{
                    animation: "saffron-dot-cycle 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                    opacity: 0.25,
                  }}
                >
                  .
                </span>
              ))}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
