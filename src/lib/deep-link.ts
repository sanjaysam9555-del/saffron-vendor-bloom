import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";

/**
 * Deep-link focus helper.
 *
 * Universal search navigates with a `?focus=<record id>` param. Any list that
 * renders `data-focus-id="<record id>"` on its rows will be centered and
 * briefly highlighted when that record is the deep-link target.
 */

const HIGHLIGHT_MS = 2400;

/** Nearest ancestor that actually scrolls — tables/boards scroll in their own pane. */
function scrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const canScroll = /(auto|scroll|overlay)/.test(style.overflowY + style.overflowX);
    if (canScroll && (node.scrollHeight > node.clientHeight + 4 || node.scrollWidth > node.clientWidth + 4)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function stickyOffset(): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--focus-scroll-offset")
    .trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Center `el` in its scroll container (or the window), allowing for sticky chrome. */
function centerElement(el: HTMLElement) {
  const offset = stickyOffset();
  const container = scrollableAncestor(el);

  if (container) {
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.top - cRect.top - (container.clientHeight - eRect.height) / 2;
    container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
    // The container may itself sit below the fold on mobile.
    if (cRect.top < offset || cRect.bottom > window.innerHeight) {
      window.scrollBy({ top: cRect.top - offset - 12, behavior: "smooth" });
    }
    return;
  }

  const rect = el.getBoundingClientRect();
  const viewport = window.innerHeight - offset;
  const target = window.scrollY + rect.top - offset - Math.max(0, (viewport - rect.height) / 2);
  window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
}

export function useFocusTarget(id: string | undefined, ready = true) {
  useEffect(() => {
    if (!id || !ready || typeof document === "undefined") return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const attempt = (tries: number) => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
      if (!el) {
        if (tries > 0) window.setTimeout(() => attempt(tries - 1), 220);
        return;
      }

      centerElement(el);
      el.classList.add("deep-link-focus");
      const fade = window.setTimeout(() => el.classList.add("deep-link-focus-out"), HIGHLIGHT_MS);
      const done = window.setTimeout(
        () => el.classList.remove("deep-link-focus", "deep-link-focus-out"),
        HIGHLIGHT_MS + 480,
      );
      cleanup = () => {
        window.clearTimeout(fade);
        window.clearTimeout(done);
        el.classList.remove("deep-link-focus", "deep-link-focus-out");
      };
    };

    attempt(12);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id, ready]);
}

/** Shape of the deep-link params understood across the app. */
export interface DeepLinkSearch {
  v?: string;
  tab?: string;
  focus?: string;
  date?: string;
}

export function validateDeepLinkSearch(search: Record<string, unknown>): DeepLinkSearch {
  const str = (k: string) => (typeof search[k] === "string" ? (search[k] as string) : undefined);
  return { v: str("v"), tab: str("tab"), focus: str("focus"), date: str("date") };
}

/**
 * Shared "close the deep-linked view" behaviour.
 *
 * Universal search *pushes* a history entry, so the natural way out is to go
 * back — that restores the previous URL and the browser's own scroll position.
 * When the deep link was opened from a pasted/shared URL (no entry of ours to
 * pop) we strip the params with a replace instead, and restore the scroll
 * position we captured when the focus first ran.
 */
export function useDeepLinkExit(params: DeepLinkSearch, to: string) {
  const navigate = useNavigate();
  const router = useRouter();
  const entryAtMountRef = useRef<number | null>(null);
  const scrollRef = useRef<number | null>(null);
  const hadParamsRef = useRef(false);

  const active = !!(params.v || params.focus);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (active && !hadParamsRef.current) {
      hadParamsRef.current = true;
      entryAtMountRef.current = window.history.length;
      scrollRef.current = window.scrollY;
    } else if (!active) {
      hadParamsRef.current = false;
    }
  }, [active]);

  return useCallback(() => {
    if (!active) return;
    const state = router.history.location.state as { key?: string; __deepLink?: boolean } | undefined;
    const canPop = typeof window !== "undefined" && !!state?.__deepLink;

    if (canPop) {
      router.history.back();
      return;
    }

    const restore = scrollRef.current;
    navigate({
      to,
      search: (prev: Record<string, unknown>) => ({ ...prev, v: undefined, focus: undefined }),
      replace: true,
    } as never);
    if (restore != null && typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo({ top: restore }));
    }
  }, [active, navigate, router, to]);
}
