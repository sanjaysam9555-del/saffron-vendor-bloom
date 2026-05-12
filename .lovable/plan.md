
# Make planwithsaffron.in feel instant

Goal: the homepage paints immediately, sign-in lands on the dashboard in under a second, and dashboards stay fluid even with many vendors. No behavior changes — only speed and smoothness.

## 1. Fix the slow sign-in path

Current: `signIn()` calls `loadAccess()` itself, then `onAuthStateChange` fires and a second `loadAccess()` runs. The button shows "loading" the whole time. Two role lookups per login + two profile lookups.

Fixes in `src/lib/auth.tsx`:
- `loadAccess` already runs from the auth listener — keep that, and inside `signIn` set `loadedForRef.current = userId` BEFORE awaiting so the listener's deferred call is skipped.
- Run `resolveAccess` and the navigation in parallel: optimistically set role from cache (when same user) and navigate immediately; revalidate in background.
- For the staff fast-path, skip the `profiles` fetch on hot path — derive `displayName` from `user_metadata.display_name` or email local-part, then refresh in background. Saves one round-trip per login.
- Drop the `setTimeout(..., 0)` wrapper around `loadAccess` in the listener — call it directly; the deferral was a workaround that adds latency.

In `UnifiedLoginForm.tsx`:
- Navigate as soon as `signIn` returns a role, in the same tick (no waiting for the auth listener echo).
- Remove the second redirect effect that watches `session/role` after sign-in (it duplicates work and can fight the explicit navigate).

## 2. Stop double-rendering and full-screen splashes

- `src/routes/index.tsx`: drop `<ClientOnly>` around `UnifiedLoginForm`. The form is already SSR-safe; `ClientOnly` forces a skeleton flash on every visit and delays interactivity.
- `AuthGate` / `ClientGate`: when a cached role exists for the same user, render children optimistically and revalidate in background instead of showing the inline loader.
- `RouteProgress`: only show after a 150ms delay so fast transitions never flash a bar.
- Remove the `defaultPreloadDelay: 50` aggressiveness in `src/router.tsx` — bump to `300` so hovering doesn't kick off preloads while the user is reading.

## 3. Defer heavy queries on the dashboards

`src/hooks/useVendorData.ts` (admin):
- Subscribe to realtime only after the first vendor list returns (currently subscribes on mount, before auth is even ready).
- Debounce the `invalidateQueries` from realtime (250ms) so a burst of updates causes one refetch.

`src/routes/client.index.tsx`:
- Same realtime debounce; combine the 6 channels' handlers into one debounced invalidator.
- Wait for `data?.project?.id` before subscribing (already done) — keep, but tear down on tab visibility hidden to save sockets.

`src/hooks/use-instagram-previews.ts` + dashboards:
- Don't run `useInstagramPreviewsBulk` until the vendor grid is mounted AND the browser is idle (`requestIdleCallback` or a 400ms `setTimeout`). Previews are decorative; current data + filters should render first.
- Increase `staleTime` to 30 minutes — Instagram thumbnails don't change minute-to-minute.

## 4. Ship less to first paint

- `src/routes/__root.tsx`: load Google Fonts non-blocking. Replace the blocking `<link rel="stylesheet" href="…fonts.googleapis…">` with `rel="preload" as="style" onload="this.rel='stylesheet'"` + a `<noscript>` fallback. Saves ~200–400ms of render-blocking on slow networks.
- Keep the existing in-file QueryClient defaults but lower retry to `0` for queries (they're authenticated; failure is usually permanent and retry just adds 2s) — mutations keep retry off.
- `vite.config`: ensure manual chunking splits Supabase, Lucide icons, and TanStack Query into separate vendor chunks so the homepage doesn't pull the whole admin bundle.

## 5. Trim payloads on the wire

- `src/server/vendors.functions.ts` `listVendorsServer`: select only the columns the cards/tables actually render (drop large notes / file blobs / JSON columns from the list query). Detail drawer can fetch the full row on open.
- `getMyProject`: same — return list-shape vendors for the grid, fetch quote/comments details on row click.

(I'll confirm the exact dropped columns by reading those functions before editing.)

## 6. Validation

After changes, I'll:
- Reload `/` cold and confirm first paint is the marketing copy + form (no skeleton flash) using browser tools.
- Sign in as staff and as a client; expect green tick → dashboard within ~500ms.
- Profile the admin dashboard with the browser performance tool; confirm Instagram bulk is deferred and realtime invalidations are debounced.

## Files I'll touch

`src/lib/auth.tsx`, `src/components/auth/UnifiedLoginForm.tsx`, `src/components/AuthGate.tsx`, `src/components/ClientGate.tsx`, `src/components/RouteProgress.tsx`, `src/router.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/hooks/useVendorData.ts`, `src/hooks/use-instagram-previews.ts`, `src/routes/client.index.tsx`, `src/server/vendors.functions.ts`, `src/server/projects.functions.ts`, `vite.config.ts`.

No database changes. No UX changes — only fewer round-trips, less render-blocking, and smarter caching.
