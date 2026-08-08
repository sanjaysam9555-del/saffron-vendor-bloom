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

const PREFS_KEY = "saffron.universal-search.prefs";

/** Last query + selected category chips, remembered per device. */
export interface SearchPrefs {
  q: string;
  kinds: string[];
}

export function readSearchPrefs(): SearchPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SearchPrefs>) : null;
    return {
      q: typeof parsed?.q === "string" ? parsed.q : "",
      kinds: Array.isArray(parsed?.kinds) ? (parsed!.kinds as string[]) : [],
    };
  } catch {
    return { q: "", kinds: [] };
  }
}

export function writeSearchPrefs(prefs: SearchPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Called on sign-out so the next account starts clean. */
export function clearSearchPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
