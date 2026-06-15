import confetti from "canvas-confetti";
import { prefersReducedMotion } from "@/hooks/use-reduced-motion";
import { getMarigoldShapes, MARIGOLD_COLORS } from "./petal-shapes";

/**
 * Plays a warm marigold-petal shower when a vendor is marked as booked.
 *
 * - Skipped entirely under `prefers-reduced-motion`.
 * - Origin defaults to the top-center of the viewport; pass `origin`
 *   (normalized 0-1, top-left coords) to fire from a specific element.
 */
export function celebrateBooking(origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  const shapes = getMarigoldShapes();
  const base = {
    colors: MARIGOLD_COLORS,
    spread: 80,
    startVelocity: 28,
    ticks: 220,
    gravity: 0.6, // slower fall — petals drift, not plummet
    scalar: 1.15,
    decay: 0.93,
    disableForReducedMotion: true,
    origin: origin ?? { x: 0.5, y: 0.12 },
    shapes: shapes.length > 0 ? shapes : (["circle"] as const),
  } as Parameters<typeof confetti>[0];

  // Main petal burst.
  confetti({ ...base, particleCount: 70 });

  // Soft follow-up drift for depth.
  window.setTimeout(() => {
    confetti({
      ...base,
      particleCount: 28,
      startVelocity: 18,
      spread: 110,
      scalar: 1.4,
      gravity: 0.5,
    });
  }, 180);
}

/**
 * Fires the marigold shower centered on the bounding box of the given element.
 */
export function celebrateFromElement(el: Element | null | undefined) {
  if (!el || typeof window === "undefined") return celebrateBooking();
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  celebrateBooking({ x, y });
}
