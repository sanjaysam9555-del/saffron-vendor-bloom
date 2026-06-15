import type { Transition, Variants } from "motion/react";

/**
 * Shared motion presets. Keeps every animation in the app consistent
 * (warm & lively spring) and easy to tune from one place.
 *
 * Helpers accept a `reduced` flag — when true, presets collapse to a
 * quick opacity-only fade so motion-sensitive users still get state
 * feedback without movement.
 */

export const springSoft: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 22,
  mass: 0.9,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 240,
  damping: 24,
  mass: 0.7,
};

export function fadeUp(reduced = false): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.15 } },
    };
  }
  return {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: springSnappy },
  };
}

export function scaleIn(reduced = false): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.15 } },
    };
  }
  return {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: springSnappy },
  };
}

export function stagger(reduced = false, childDelay = 0.05): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : childDelay,
        delayChildren: reduced ? 0 : 0.02,
      },
    },
  };
}
