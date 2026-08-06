import { useEffect, useState } from "react";

interface LoadingStateProps {
  /** `fullscreen` fills the viewport on a cream backdrop; `inline` sits inside existing page chrome. */
  variant?: "fullscreen" | "inline";
  /** Context line, e.g. "Loading your dashboard". */
  label?: string;
  /** Delay before the loader fades in, so fast loads never flash. */
  delayMs?: number;
  className?: string;
}

/**
 * The single loading treatment used across the app: a thin rotating arc, a
 * quiet context line, and a hairline sweep. No brand marks — geometry + type.
 */
export function LoadingState({
  variant = "inline",
  label = "Loading",
  delayMs = 200,
  className = "",
}: LoadingStateProps) {
  const [shown, setShown] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  const wrapper =
    variant === "fullscreen"
      ? "flex min-h-screen items-center justify-center bg-[var(--cream)] px-6"
      : "flex w-full items-center justify-center px-6 py-14";

  return (
    <div className={`${wrapper} ${className}`} role="status" aria-live="polite">
      <div
        className="flex flex-col items-center gap-5 transition-opacity duration-500"
        style={{ opacity: shown ? 1 : 0 }}
      >
        {/* Thin arc on a faint ring */}
        <span className="loader-arc" aria-hidden />

        <span className="text-[0.78rem] tracking-[0.14em] text-[var(--charcoal)]/55">
          {label}
        </span>

        {/* Hairline track with a sweeping sliver */}
        <span className="loader-track" aria-hidden>
          <span className="loader-sliver" />
        </span>
      </div>
    </div>
  );
}

/** Shared skeleton placeholder so every list uses the same pulse and radius. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-xl border border-[var(--border)]/60 bg-[var(--cream-deep)]/50 ${className}`}
    />
  );
}
