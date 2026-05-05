## Problem

The app crashes with `cannot add postgres_changes callbacks for realtime:categories-sync after subscribe()`. This is the error blocking both the preview and the live site (the root error boundary catches it and shows "Something went wrong").

### Root cause

`useAllCategories()` in `src/lib/categories.ts` creates a Supabase Realtime channel named `"categories-sync"` inside `useEffect`. The hook is used by many components at once (vendor `Sidebar`, `ClientSidebar`, `admin.index`, `VendorForm`, `CategoryManager`, etc.). Supabase Realtime de-duplicates channels by name, so the second mount tries to add a `.on("postgres_changes", ...)` listener to a channel that has already called `.subscribe()` — which Realtime forbids and throws.

## Fix

Lift the realtime channel out of the React hook and create it exactly once at the module level. The hook then only subscribes to the in-memory listener set (which is already module-scoped and safe).

### Changes — `src/lib/categories.ts`

1. Add a module-level `ensureRealtime()` that lazily creates one shared channel:
   - Build the channel with `.on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => void refreshCategories())`.
   - Call `.subscribe()` once.
   - Guard with a `realtimeChannel` singleton variable so subsequent calls are no-ops.
   - Skip when `typeof window === "undefined"` (SSR).

2. Simplify `useAllCategories()`:
   - Keep `subscribeCategories(update)` and `void refreshCategories()`.
   - Replace the per-mount channel creation with a single `ensureRealtime()` call.
   - Remove the channel cleanup in the unmount handler (the shared channel lives for the lifetime of the page).

This eliminates the duplicate `.on()` after `.subscribe()` and resolves the crash everywhere the hook is mounted.

## Verification

- Reload the admin dashboard — no error boundary, no console error about `categories-sync`.
- Mount multiple consumers of `useAllCategories` on the same page (admin index + sidebar) — still no error.
- Add/rename/delete a category from another tab — list updates live (realtime still works).
- Live published site loads normally.
