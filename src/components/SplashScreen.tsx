import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const MIN_MS = 1200;
const MAX_MS = 3000;
const FADE_MS = 350;
const SHOWN_KEY = "saffron.splash.shown.v1";

function alreadyShown(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markShown() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    /* noop */
  }
}

export function SplashScreen() {
  const { initialized } = useAuth();
  const [mounted, setMounted] = useState(false);
  // Skip entirely if we've already shown the splash this tab session.
  const [shouldShow] = useState(() => !alreadyShown());
  const [visible, setVisible] = useState(shouldShow);
  const [fading, setFading] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (shouldShow) markShown();
  }, [shouldShow]);

  useEffect(() => {
    if (!shouldShow) return;
    const minT = setTimeout(() => setMinElapsed(true), MIN_MS);
    const maxT = setTimeout(() => setFading(true), MAX_MS);
    return () => {
      clearTimeout(minT);
      clearTimeout(maxT);
    };
  }, [shouldShow]);

  useEffect(() => {
    if (minElapsed && initialized) setFading(true);
  }, [minElapsed, initialized]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setVisible(false), FADE_MS);
    return () => clearTimeout(t);
  }, [fading]);

  if (!shouldShow || !mounted || !visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "var(--terracotta)",
          marginBottom: "1.25rem",
        }}
      >
        Saffron Planning Studio
      </p>
      <h1
        className="font-display"
        style={{
          fontSize: "clamp(1.75rem, 6vw, 2.75rem)",
          fontWeight: 500,
          color: "var(--charcoal)",
          margin: 0,
          maxWidth: "22ch",
          lineHeight: 1.15,
        }}
      >
        Welcome to Saffron Planning Studio
      </h1>
      <div
        style={{
          width: 48,
          height: 1,
          background: "var(--terracotta)",
          margin: "1.5rem auto",
          opacity: 0.7,
        }}
      />
      <p
        className="font-display"
        style={{
          fontStyle: "italic",
          fontSize: "clamp(0.95rem, 2.5vw, 1.15rem)",
          color: "color-mix(in oklab, var(--charcoal) 75%, transparent)",
          maxWidth: "32ch",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        “Extraordinary weddings don't just happen, they are planned.”
      </p>
    </div>
  );
}
