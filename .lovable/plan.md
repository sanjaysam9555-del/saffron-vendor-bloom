## Goal

One stored Instagram preview per vendor in `vendor_instagram_previews`. Every surface (admin grid, admin client-preview, client grid, client detail drawer, vendor detail drawer) reads that one row and renders it instantly. Nothing triggers a scrape on view — scraping only happens on (a) new vendor creation and (b) the admin "Refresh" button. No client ever calls Apify.

## Current problems

- `useAutoEnsureMissingPreviews` runs on every admin/client grid mount and calls `ensureVendorInstagramPreview` for any row whose `fetched_at` is older than 3 days, or whose cached LS handle doesn't match the normalized handle. Even with 493/502 vendors marked `ok`, this fires hundreds of background scrapes per page view (visible in the network panel — `ensure...handler` with `force:true` for already-fresh rows). That's the bulk of Apify token spend.
- Clients hit `ensureVendorInstagramPreview` indirectly (the same hook is mounted in `client.index.tsx` → `ClientVendorGrid`). The server fn does an authorization check then still calls Apify on their behalf if the row looks "stale" by its rules.
- The client detail drawer uses `useEnsureInstagramPreview` (per-vendor ensure). That's a second call layer on top of bulk.
- `VendorInstagramCardStrip` shows a skeleton whenever `preview === undefined || preview === null`. On the client grid the first paint is `null` until the bulk request returns; on slow networks this looks like "not loading", and any ensure call that overwrites with an `error` row keeps it stuck.

## Plan

### 1. Single read path: `useInstagramPreviewsBulk` only

Used by both admin and client grids. Keep its localStorage hydration + per-vendor cache seeding. No behavior change for the read; it already returns the DB row as-is.

### 2. Detail drawer reads from the same cache, never ensures

- Replace `useEnsureInstagramPreview` inside `VendorInstagramDetailBlock` with a read-only lookup: per-vendor query cache → any bulk cache → localStorage → `null`. Returns immediately; no server call.
- The admin "Refresh" button keeps using `useRefreshInstagramPreview` (staff-only, manual).

### 3. Kill auto-ensure on view

- Delete `useAutoEnsureMissingPreviews` calls from `client.index.tsx`, `admin.index.tsx`, and `admin.projects.$id.preview.$clientId.tsx`. The hook stays exported but unused (kept for the backfill flow).
- DB already has 100% coverage for vendors with handles. Anything missing/erroring gets fixed by the staff "Backfill" job or manual refresh — not by every page view.

### 4. New-vendor scrape stays one-shot

`useTriggerInstagramPreview` (used by `VendorForm` on create) is the only auto path that should ever call ensure. It runs once per new vendor and is staff-only.

### 5. Lock down `ensureVendorInstagramPreview` server fn

- Reject calls from non-staff (return `null`). Clients have no business triggering a scrape; bulk read is enough for them.
- Treat `force=true` as staff-only.
- Tighten the "shall we re-scrape" rule for any remaining staff path:
  - If a row exists with `status === 'ok'`, return it as-is. No staleness check, no overwrite. (Matches the "if there is a preview, don't touch it" requirement.)
  - Only scrape when no row exists, or the row is `not_found`/`error` AND the caller passed `force=true`.

### 6. Skeleton vs empty-state in the card strip

`VendorInstagramCardStrip`: keep the skeleton only while bulk fetch is in flight (i.e., `preview === undefined`). Once bulk has returned, render:
- the preview if `ok`,
- the friendly "No Instagram preview" empty state otherwise (covers `not_found`, `error`, and DB-missing rows).

This fixes the "stuck skeleton" feeling on the client side: once the bulk POST resolves, the UI commits and stops waiting.

### 7. Token-spend safety net

Add a small server-side log line in `ensureVendorInstagramPreview` whenever it actually calls Apify (vendorId + reason). Lets staff verify scrape volume drops to ~0 after this lands.

## Files touched

- `src/hooks/use-instagram-previews.ts` — remove auto-ensure usage; add a read-only `useInstagramPreviewFromCache(vendorId, handle)` helper that doesn't issue any request.
- `src/components/vendor/VendorInstagramPreview.tsx` — `VendorInstagramDetailBlock` uses the new read-only helper; `VendorInstagramCardStrip` shows empty state once bulk resolves.
- `src/lib/instagram-preview.functions.ts` — staff-only ensure, never overwrite an `ok` row, no staleness scrape, add scrape log.
- `src/routes/client.index.tsx`, `src/routes/admin.index.tsx`, `src/routes/admin.projects.$id.preview.$clientId.tsx` — remove `useAutoEnsureMissingPreviews` calls.

## Out of scope

- Database schema (no migration; the single-row-per-vendor invariant is already enforced by the unique `vendor_id` upsert).
- Backfill UI (staff dashboard's "Backfill" already exists and is the right tool for bulk catch-up).
- Apify scraper itself (`server/instagram-preview.server.ts`).

## How to verify after build

1. Hard refresh the admin vendors grid. Network panel should show one `getVendorInstagramPreviewsBulk` call and zero `ensureVendorInstagramPreview` calls.
2. Hard refresh a client account's vendor grid. Same: one bulk read, zero ensures. Cards render the stored previews immediately.
3. Open a vendor detail drawer (admin and client). No network call; preview matches the card.
4. Click admin "Refresh" on a vendor → one Apify call, row updates, all open cards re-render.
5. Create a new vendor with a handle → one Apify call from `VendorForm`, preview appears.
