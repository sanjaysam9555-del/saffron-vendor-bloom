# Fix: Instagram previews don't auto-load for new vendors

## Root causes

1. **Cards never trigger a scrape.** `admin.index.tsx` calls `useInstagramPreviewsBulk(ids)`, which only **reads** existing rows from `vendor_instagram_previews`. A freshly added vendor has no row yet, so `previewMap.get(id)` is `undefined`, the card passes `null` to `VendorInstagramCardStrip`, and the strip shows the "No Instagram preview" fallback. The only place that actually calls `ensureVendorInstagramPreview` (the staff-side scrape) is the detail drawer (`VendorInstagramDetailBlock`). That's why a manual refresh — or just opening the drawer — is required today.

2. **Detail-drawer fetch doesn't update the card cache.** `useEnsureInstagramPreview` writes the new row to its own per-vendor key and to localStorage, but never updates the `["instagram-previews-bulk", …]` query data the card grid is subscribed to. So even after the drawer scrapes successfully, the card stays empty until the bulk query refetches (next mount / staleTime expiry). Same gap exists for `useRefreshInstagramPreview` — it invalidates but doesn't patch optimistically, so there's a visible delay.

## Changes

### 1. `src/hooks/use-instagram-previews.ts`

- Add a small helper `patchBulkCaches(qc, row)` that, for every cached `["instagram-previews-bulk", *]` query, replaces the matching `vendor_id` entry (or appends it). Also writes through to localStorage. Call it from:
  - `useEnsureInstagramPreview`'s `queryFn` after a fresh row comes back.
  - `useRefreshInstagramPreview`'s `onSuccess`.
- Add a new hook `useAutoEnsureMissingPreviews(vendors)` for staff use:
  - Input: `Array<{ id, instagram_handle }>` of currently visible vendors.
  - Reads the bulk map + localStorage; computes the set of vendors that have a handle but no cached row (or a stale/error row).
  - Sequentially (concurrency 2) calls the `ensureVendorInstagramPreview` server fn for each missing vendor; on each success, calls `patchBulkCaches` so the corresponding card re-renders immediately.
  - Guards against re-entry with a `useRef<Set<string>>` of in-flight vendor IDs, and re-runs whenever `vendors` or the bulk map changes.

### 2. `src/routes/admin.index.tsx`

- In `VendorCardGrid`, after `useInstagramPreviewsBulk(ids)`, call the new `useAutoEnsureMissingPreviews(vendors)` so newly added vendors get scraped automatically on the grid.

### 3. `src/components/vendor/VendorInstagramPreview.tsx`

- In `VendorInstagramCardStrip`, when `hasHandle` is true and `preview === null` (cache miss, not loading), render the skeleton block instead of the "No Instagram preview" fallback. The auto-ensure hook will fill it in within seconds. The "No Instagram preview" message stays for the explicit failure case (`status !== "ok"` on a fetched row).

### 4. Vendor create flow (`VendorForm` save path)

- After a successful create whose payload includes a non-empty `instagram_handle`, fire-and-forget the `ensureVendorInstagramPreview` server fn for the new vendor id, then `patchBulkCaches` on the returned row. This guarantees the new card and the just-opened detail page both light up without a manual refresh, even before the grid re-renders.

## Out of scope

- Client-side cards: clients can't trigger scrapes server-side, so behavior there is unchanged (they continue to see whatever staff has cached).
- Backfill job UI.
