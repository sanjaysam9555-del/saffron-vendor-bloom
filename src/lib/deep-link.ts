import { useEffect } from "react";

/**
 * Deep-link focus helper.
 *
 * Universal search navigates with a `?focus=<record id>` param. Any list that
 * renders `data-focus-id="<record id>"` on its rows will be scrolled to and
 * briefly highlighted when that record is the deep-link target.
 */
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
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("deep-link-focus");
      const t = window.setTimeout(() => el.classList.remove("deep-link-focus"), 2600);
      cleanup = () => {
        window.clearTimeout(t);
        el.classList.remove("deep-link-focus");
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
