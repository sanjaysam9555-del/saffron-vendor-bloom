import { motion, type HTMLMotionProps } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { fadeUp } from "@/lib/motion-presets";

interface RevealProps extends HTMLMotionProps<"div"> {
  /** Pixel offset to shift before animating (default 8). */
  offset?: number;
  /** Intersection threshold (default 0.15). */
  amount?: number;
  /** Delay before the animation begins, in seconds. */
  delay?: number;
}

/**
 * Lightweight scroll-reveal wrapper.
 *
 * Renders content with a one-shot fade-up when it scrolls into view.
 * Respects `prefers-reduced-motion` and falls back to a plain opacity
 * fade.
 */
export function Reveal({
  children,
  offset = 8,
  amount = 0.15,
  delay = 0,
  ...rest
}: RevealProps) {
  const reduced = useReducedMotion();
  const variants = fadeUp(reduced);
  // Allow per-instance offset override.
  if (!reduced && offset !== 8) {
    variants.hidden = { ...variants.hidden, y: offset };
  }
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      transition={delay ? { delay } : undefined}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
