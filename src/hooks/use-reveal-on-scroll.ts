import { useEffect, useRef, useState } from "react";

/**
 * Shared IntersectionObserver-based reveal hook.
 *
 * One observer instance is reused across every consumer so long lists
 * don't spawn thousands of observers. Each element unobserves itself
 * after first reveal — once visible, it stays visible.
 *
 * Usage:
 *   const { ref, isVisible } = useRevealOnScroll();
 *   <div ref={ref} className={isVisible ? "animate-fade-in" : "opacity-0"} />
 */

type Cb = (visible: boolean) => void;

let sharedObserver: IntersectionObserver | null = null;
const subscribers = new WeakMap<Element, Cb>();

function getObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    return null;
  }
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const cb = subscribers.get(entry.target);
          if (cb) {
            cb(true);
            sharedObserver?.unobserve(entry.target);
            subscribers.delete(entry.target);
          }
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );
  return sharedObserver;
}

export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect reduced-motion: instantly reveal.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsVisible(true);
      return;
    }

    const observer = getObserver();
    if (!observer) {
      // No IO support — reveal immediately.
      setIsVisible(true);
      return;
    }

    subscribers.set(node, (v) => setIsVisible(v));
    observer.observe(node);

    return () => {
      observer.unobserve(node);
      subscribers.delete(node);
    };
  }, []);

  return { ref, isVisible };
}
