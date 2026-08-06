import { useEffect, useSyncExternalStore } from "react";

/**
 * Tiny store so a page can push its own (dynamic) title into the mobile top
 * bar — used for routes whose heading isn't static, e.g. a project's couple
 * names. Static routes are handled by the path map in AdminSidebar.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useMobilePageTitleValue(): string | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Sets the mobile header title for as long as the component is mounted. */
export function useSetMobilePageTitle(title: string | null | undefined) {
  useEffect(() => {
    current = title ?? null;
    emit();
    return () => {
      current = null;
      emit();
    };
  }, [title]);
}
