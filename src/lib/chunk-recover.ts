// Auto-reload once when a dynamic import fails. This recovers from:
//   - Vite dev preview rebuilds that orphan an in-flight client entry
//   - Production redeploys that change chunk hashes while a tab is open
// Guarded by sessionStorage so we never loop.

const FLAG = "saffron.chunk-reload.v1";
const PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

function shouldReload(message: string | undefined): boolean {
  if (!message) return false;
  if (!PATTERN.test(message)) return false;
  // In dev, stale-module errors come from HMR / file moves — Vite's overlay
  // handles them. Auto-reloading turns every transient dev error into a
  // jarring full page reload (and re-shows the splash on every click).
  if (import.meta.env.DEV) return false;
  try {
    if (window.sessionStorage.getItem(FLAG)) return false;
    window.sessionStorage.setItem(FLAG, String(Date.now()));
  } catch {
    /* sessionStorage unavailable — still reload once */
  }
  return true;
}

export function installChunkRecovery() {
  if (typeof window === "undefined") return;
  // Clear the flag after a successful boot so a future stale-chunk failure
  // can recover again. 30s is enough to be past hydration.
  window.setTimeout(() => {
    try { window.sessionStorage.removeItem(FLAG); } catch { /* noop */ }
  }, 30_000);

  window.addEventListener("error", (event) => {
    if (shouldReload(event.message)) window.location.reload();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : undefined;
    if (shouldReload(message)) window.location.reload();
  });
}
