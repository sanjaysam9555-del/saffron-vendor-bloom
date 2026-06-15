import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface CrossfadeProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  /** Optional className applied to both wrappers. */
  className?: string;
}

/**
 * Smoothly cross-fade between a skeleton and resolved content so query
 * results don't snap in. Respects `prefers-reduced-motion`.
 */
export function Crossfade({ isLoading, skeleton, children, className }: CrossfadeProps) {
  const reduced = useReducedMotion();
  const dur = reduced ? 0.12 : 0.22;
  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
