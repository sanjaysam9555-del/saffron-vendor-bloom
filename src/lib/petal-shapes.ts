import confetti from "canvas-confetti";

/**
 * Marigold-inspired petal shapes for canvas-confetti. Built once per session
 * (canvas-confetti expects pre-built Shape objects, not raw paths).
 *
 * Two slightly different petal silhouettes give the shower visual variation
 * without looking like dots or squares.
 */

type Shape = ReturnType<typeof confetti.shapeFromPath>;

let cached: Shape[] | null = null;

export function getMarigoldShapes(): Shape[] {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof confetti.shapeFromPath !== "function") {
    cached = [];
    return cached;
  }

  // Teardrop petal — wider at the base, tapered top.
  const teardrop =
    "M0,-10 C5,-9 7,-3 6,3 C5,8 2,10 0,10 C-2,10 -5,8 -6,3 C-7,-3 -5,-9 0,-10 Z";
  // Rounded petal — softer oval marigold flake.
  const oval =
    "M0,-9 C5,-9 6,-4 6,0 C6,4 5,9 0,9 C-5,9 -6,4 -6,0 C-6,-4 -5,-9 0,-9 Z";

  cached = [
    confetti.shapeFromPath({ path: teardrop }),
    confetti.shapeFromPath({ path: oval }),
  ];
  return cached;
}

/** Saffron / marigold palette: deep orange → saffron → gold → cream highlight. */
export const MARIGOLD_COLORS = [
  "#E85D1F", // deep marigold
  "#F2841B", // saffron orange
  "#F4A82B", // amber
  "#F5C84C", // gold
  "#FFE39A", // pale highlight
];
