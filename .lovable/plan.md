## What I found

**1. Splash screen ("Welcome to Saffron Planning Studio") on every click**

The `SplashScreen` component in `src/components/SplashScreen.tsx` is shown on every mount of the root layout and stays visible for at least 1200ms (`MIN_MS`). It has no "I already showed once" memory — every fresh page load shows it.

Normal SPA navigation inside `/admin/*` is client-side (TanStack Router `<Link>`), so the root layout does NOT remount and the splash should not reappear. But the project also runs a `chunk-recover` helper that calls `window.location.reload()` whenever a dynamic-import error fires (`src/lib/chunk-recover.ts`). Since the recent file moves (`src/server/*.functions.ts → src/lib/*.functions.ts`), the dev server has been emitting stale-module / "Cannot read properties of undefined (reading 'method')" errors. Those fire `unhandledrejection`, which trips `chunk-recover` → full reload → splash. Result: splash on virtually every click.

**2. Instagram previews not loading**

Two compounding causes:
- Many vendor `instagram_handle` values are stored as **full URLs** (e.g. `https://www.instagram.com/saini_caterers/`) or even non-Instagram links (Google Drive folders). The scraper normalizes the URL to `saini_caterers` and queries Apify, but for legacy rows the DB already contains `status:"error"`/`last_error:"not_found"` from earlier bad attempts.
- `ensureVendorInstagramPreview` enforces a 10-minute retry cooldown on failed rows, so the bulk fetch keeps returning the old error rows and the card strip falls back to skeleton/"No Instagram preview". The auto-ensure loop also skips re-trying anything younger than the cooldown.

The Apify token IS configured, and previews that have a clean handle and a fresh ok row DO render (visible for `inari_5_`, `purpleplatecatering`, etc. in the replay). So this is about stale error rows, not a broken scraper.

## Plan

### A. Stop the reload-on-every-click

1. Make the splash a one-shot per session.
   - In `src/components/SplashScreen.tsx`, gate the entire visible state behind a `sessionStorage` flag (`saffron.splash.shown.v1`). After the first show, subsequent mounts return `null` immediately. This already kills the perceived "loading screen on every click" even if a reload sneaks in.

2. Make `chunk-recover` less trigger-happy in dev.
   - In `src/lib/chunk-recover.ts`, also skip when `import.meta.env.DEV` (or only reload when the failing URL contains `/assets/` — a real chunk-hash mismatch). Stale dev-server module errors should surface as overlays, not reloads.

3. (Belt-and-braces) confirm there's nothing else doing `location.reload`/`<a href>` in the admin header. If found, swap to `<Link>` / `useNavigate`.

### B. Make Instagram previews populate

1. Normalize the handle on the client BEFORE calling the server function.
   - In `src/hooks/use-instagram-previews.ts` (`useAutoEnsureMissingPreviews`, `useTriggerInstagramPreview`, `useEnsureInstagramPreview`) and in the vendor form, pass `normalizeInstagramHandle(v.instagram_handle)` and skip vendors where the normalized handle is empty or looks non-instagram (e.g. starts with `drive.google.com`, contains a path slash after normalization, or is longer than 30 chars).

2. Force one-time rescrape of legacy error rows.
   - Lower the server retry cooldown for `not_found` rows to ~30 s (separate constant from the general error cooldown), and add an `force?: boolean` flag to `ensureVendorInstagramPreview` that bypasses the cooldown. The hook calls it with `force: true` once per vendor per session for rows where `status !== "ok"` AND the cached handle differs from the now-normalized handle (i.e. legacy URL-as-handle rows).

3. Run the existing staff backfill job in `missing_or_stale` mode after deploy so all the error rows get reprocessed with the normalized handles. No code change needed — just a one-click action from the existing admin UI.

### C. Verification

- Reload preview, navigate Vendors ↔ Projects ↔ Project Detail: splash should appear at most once per tab.
- Open the Vendors tab: cards with valid Instagram handles should populate avatars/thumbnails within a few seconds (auto-ensure). Cards with junk handles (Drive links etc.) should render the "No Instagram preview" placeholder instead of an endless skeleton.
- Spot-check network: `_serverFn/...ensureVendorInstagramPreview` returns `status:"ok"` for vendors whose previous row was `error`.

## Technical notes

- Files touched: `src/components/SplashScreen.tsx`, `src/lib/chunk-recover.ts`, `src/hooks/use-instagram-previews.ts`, `src/lib/instagram-preview.functions.ts`, `src/server/instagram-preview.server.ts` (only the cooldown constant + new `force` plumbing).
- No DB migration required — the backfill writes through the existing `vendor_instagram_previews` table.
- No change to the auth/AuthGate path; the splash fix removes the symptom without touching authentication flow.
