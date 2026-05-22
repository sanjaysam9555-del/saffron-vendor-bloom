## Problem

Instagram previews load instantly on the **admin** dashboard but not on the **client** dashboard (cards stay on the skeleton, the detail drawer shows "No preview cached yet").

## Root cause

In `src/hooks/use-instagram-previews.ts` only the admin route calls `useAutoEnsureMissingPreviews(vendors, previewMap)`. That hook is what:

1. Detects vendors whose `vendor_instagram_previews` row is missing/errored, and
2. Calls `ensureVendorInstagramPreview` to scrape Instagram and patch the cache for every visible card.

The client route (`src/routes/client.index.tsx`) only calls `useInstagramPreviewsBulk(ids)` — a pure read of whatever rows already exist. And the server fn `ensureVendorInstagramPreview` has an early `if (!isStaff) return row;` (line 147 of `src/server/instagram-preview.functions.ts`), so even if a client did call it, no scrape would happen.

Net effect: any vendor that an admin has never opened on the admin dashboard has no cached row, so the client gets `null` from the bulk read and the card sits on the loading skeleton forever, and the detail block falls through to "No preview cached yet".

## Fix

Two small, surgical changes — no UI redesign, no schema changes.

### 1. Allow server-side scraping for client viewers (rate-limited)

In `src/server/instagram-preview.functions.ts`, change `ensureVendorInstagramPreview` so non-staff callers are also allowed to trigger a scrape, but only when:

- The vendor is one the caller is actually allowed to see (reuse the same `project_clients` → `project_vendors` join used in `getVendorInstagramPreviewsBulk`), and
- The row is missing, or older than `STALE_DAYS`, or in `error`/`not_found` past the existing `RETRY_COOLDOWN_MS` cool-down.

`refreshVendorInstagramPreview` (the manual "Refresh" button) stays staff-only.

This makes the client experience match admin: the first client to open the dashboard warms the cache; subsequent visits hit cache + localStorage and render instantly.

### 2. Wire `useAutoEnsureMissingPreviews` into the client grid

In `src/routes/client.index.tsx` (`ClientVendorGrid`), mirror the admin route:

```ts
const ids = useMemo(...)
const { map: previewMap } = useInstagramPreviewsBulk(ids);
useAutoEnsureMissingPreviews(vendors, previewMap); // <- add
```

The hook already defers work via `requestIdleCallback`, caps concurrency at 6, and tracks an in-flight set, so it won't hammer Apify. With the virtualized grid only ~15 cards are mounted at a time, so the ensure queue stays small.

### 3. Detail drawer needs no code change

`VendorInstagramDetailBlock` already calls `useEnsureInstagramPreview`. Once change (1) lifts the staff-only block, the same call will warm the cache for clients too, and the existing `initialData` (per-vendor cache + localStorage) keeps revisits instant.

## Out of scope

- Pagination, search, or any other perf work.
- Visual changes to the strip/detail.
- Changes to the bulk backfill job or admin "Refresh" button.

## Expected outcome

First client visit: cards show skeleton briefly while missing rows are scraped in the background (same as admin's first visit), then resolve to real previews and persist in localStorage. Subsequent visits and detail-drawer opens render instantly from cache.
