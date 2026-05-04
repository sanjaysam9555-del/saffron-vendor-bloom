import logo from "@/assets/saffron-events-loader.png";

/**
 * Full-screen branded splash. Used everywhere we need to mask UI while
 * something is loading — route transitions, auth restoration, dashboards
 * fetching first paint data, and the iOS PWA cold boot.
 *
 * Solid terracotta background with the Saffron logo + wordmark, gently
 * pulsing. No "Loading…" text.
 */
export function BrandSplash() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--terracotta)]"
    >
      <img
        src={logo}
        alt=""
        className="h-32 w-auto sm:h-40"
        style={{ animation: "saffron-pulse 2s ease-in-out infinite" }}
      />
      <div className="mt-6 text-center text-[var(--cream)]">
        <p className="font-display text-2xl tracking-wide sm:text-3xl">
          Saffron Planning Studio
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[var(--cream)]/70">
          Wedding & Event Planning
        </p>
      </div>
    </div>
  );
}
