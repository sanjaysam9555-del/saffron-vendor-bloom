import confetti from "canvas-confetti";
import { prefersReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Plays a short, warm confetti burst when a vendor is marked as booked.
 *
 * - Skipped entirely under `prefers-reduced-motion`.
 * - Origin defaults to the top-center of the viewport; pass `origin`
 *   (normalized 0-1, top-left coords) to fire from a specific element.
 */
export function celebrateBooking(origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  const colors = ["#9F3822", "#C8743A", "#E7B36A", "#F5E3C2", "#FFFFFF"];
  const base = {
    colors,
    spread: 70,
    startVelocity: 32,
    ticks: 140,
    gravity: 0.9,
    scalar: 0.9,
    disableForReducedMotion: true,
    origin: origin ?? { x: 0.5, y: 0.15 },
  } as const;

  confetti({ ...base, particleCount: 60, shapes: ["circle", "square"] });
  // Heart-flavor follow-up burst, slightly delayed for depth.
  window.setTimeout(() => {
    confetti({
      ...base,
      particleCount: 24,
      startVelocity: 22,
      scalar: 1.1,
      shapes: ["circle"],
    });
  }, 120);
}

/**
 * Fires confetti centered on the bounding box of the given element.
 */
export function celebrateFromElement(el: Element | null | undefined) {
  if (!el || typeof window === "undefined") return celebrateBooking();
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  celebrateBooking({ x, y });
}
