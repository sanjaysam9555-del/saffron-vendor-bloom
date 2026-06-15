import { useEffect, useRef, useState } from "react";

/**
 * Shared IntersectionObserver-based reveal hook.
 *
 * One observer instance is reused across every consumer so long lists
 * don't spawn thousands of observers. Each element unobserves itself
 * after first reveal — once visible, it stays visible.
 *
 * On touch / coarse-pointer devices (mobile), we skip the observer
 * entirely and reveal immediately. iOS Safari is known to defer
 * IntersectionObserver callbacks until the next user gesture after a
 * client-side route navigation, which would otherwise leave cards
 * stuck at `opacity-0` until the user taps the screen.
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

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  // On mobile / touch devices, default to visible so we never depend on
  // an IntersectionObserver callback that iOS may defer until a tap.
  const [isVisible, setIsVisible] = useState<boolean>(() => isCoarsePointer());

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

    // Coarse pointer (touch): already revealed in the initial state.
    if (isCoarsePointer()) {
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

    // Safety net: if IO hasn't fired within 250ms (e.g. callbacks deferred
    // after a route transition), reveal anyway. Once visible, stays visible.
    const fallback = window.setTimeout(() => setIsVisible(true), 250);

    return () => {
      window.clearTimeout(fallback);
      observer.unobserve(node);
      subscribers.delete(node);
    };
  }, []);

  return { ref, isVisible };
}
