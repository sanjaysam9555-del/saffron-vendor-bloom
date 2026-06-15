import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface FlipNumberProps {
  value: number;
  /** Duration of the count animation in seconds (default 0.9). */
  duration?: number;
  className?: string;
}

/**
 * Smoothly animates a number from its previous value to the new value.
 * Renders an integer; ideal for countdowns, totals, and stats.
 */
export function FlipNumber({ value, duration = 0.9, className }: FlipNumberProps) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, duration, reduced, mv]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
