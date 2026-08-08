import { useSyncExternalStore } from "react";

/**
 * Tiny external store for the universal search overlay so any header on any
 * layout can open it, while the dialog itself is mounted once at the root.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openUniversalSearch() {
  if (open) return;
  open = true;
  emit();
}

export function closeUniversalSearch() {
  if (!open) return;
  open = false;
  emit();
}

export function toggleUniversalSearch() {
  open = !open;
  emit();
}

export function useUniversalSearchOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => false,
  );
}

const RECENT_KEY = "saffron.universal-search.recent";

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...readRecentSearches().filter((x) => x !== t)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
