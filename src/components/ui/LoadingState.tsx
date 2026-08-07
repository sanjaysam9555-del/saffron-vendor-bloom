import { useEffect, useState } from "react";

/** Optional coarse progress phase for long operations. */
export type LoadingPhase = "starting" | "buffering" | "done";

const PHASE_LABEL: Record<LoadingPhase, string> = {
  starting: "Starting up",
  buffering: "Still working — this one is taking a moment",
  done: "Almost there",
};

interface LoadingStateProps {
  /** `fullscreen` fills the viewport on a cream backdrop; `inline` sits inside existing page chrome. */
  variant?: "fullscreen" | "inline";
  /** Context line, e.g. "Loading your dashboard". Overrides the phase label. */
  label?: string;
  /** Optional phase; changes pacing and supplies a default label. */
  phase?: LoadingPhase;
  /** Delay before the loader fades in, so fast loads never flash. */
  delayMs?: number;
  className?: string;
}

/**
 * The single loading treatment used across the app: a thin rotating arc and
 * a quiet context line. No brand marks — geometry + type. Pass `phase`
 * during slow operations so the motion reflects what's happening.
 */
export function LoadingState({
  variant = "inline",
  label,
  phase,
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

  const text = label ?? (phase ? PHASE_LABEL[phase] : "Loading");

  return (
    <div
      className={`${wrapper} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy={phase !== "done"}
    >
      <div
        className="flex flex-col items-center gap-5 transition-opacity duration-500"
        style={{ opacity: shown ? 1 : 0 }}
      >
        {/* Thin arc on a faint ring */}
        <span className="loader-arc" data-phase={phase} aria-hidden />

        <span className="max-w-[16rem] text-center text-[0.78rem] tracking-[0.14em] text-[var(--charcoal)]/70 transition-opacity duration-300">
          {text}
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
