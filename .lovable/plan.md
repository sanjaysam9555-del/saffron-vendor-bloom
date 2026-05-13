## Show stale Instagram previews in parallel, no empty boxes

### Today
- `admin.index.tsx` and `client.index.tsx` call `useInstagramPreviewsBulk(ids)` after vendors render. The bulk fetch waits for the vendor list, then runs as a second roundtrip. Until it resolves, `VendorCard` / `ClientVendorCard` get `instagramPreview = undefined` and the IG strip area renders an empty container (or nothing), which "pops in" later.
- `VendorInstagramDetailBlock` (drawer) uses `useEnsureInstagramPreview`, same story.
- Cache freshness is already 30 days server-side, so almost every preview in the DB is "good enough" to show immediately. The latency is purely network + render-order.

### Goal
Cached previews appear at the same time as the rest of the card content, with zero empty placeholders. Refreshes still happen, but only behind the scenes.

### Approach

1. **Persist previews on the client for instant first paint**
   - Add a tiny `localStorage` cache (`saffron.ig.previews.v1`) keyed by `vendor_id` containing the last successful `VendorInstagramPreview` rows.
   - In `useInstagramPreviewsBulk`, hydrate the React Query cache from `localStorage` synchronously before the network call resolves (use `initialData` / `placeholderData`). The `map` returned to consumers is populated on first render, so `VendorCard` receives a real `instagramPreview` immediately.
   - On every successful bulk fetch, write the rows back to `localStorage` (capped, e.g. 500 most recent).

2. **Fetch previews in parallel with the vendor list, not after it**
   - Extract the vendor ID list as soon as the vendor query has any data (including previously-cached data from React Query). It already does this; no loader change needed since both queries live in the same component and React Query will fire them concurrently once the vendor list is known. The fix is just (1) — the bulk request stops being a blocker because cached data fills in instantly.
   - In `useInstagramPreviewsBulk`, set `keepPreviousData`/`placeholderData: (prev) => prev` so navigating between pages never blanks the strip while a refetch runs.

3. **Render-side: never show an empty container**
   - In `VendorInstagramCardStrip` (and the client equivalent), when `instagramPreview` is `undefined` (no cache yet) **and** the vendor has an `instagram_handle`, render a lightweight skeleton (3 thumb placeholders + avatar shimmer) using the existing `Skeleton` component instead of an empty div.
   - When `instagramPreview` exists but `status !== "ok"` (private/error), keep the current friendly fallback.
   - When the vendor has no handle, render nothing (unchanged).

4. **Drawer (detail) parity**
   - In `VendorInstagramDetailBlock`, seed `useEnsureInstagramPreview`'s query with the value already in the bulk cache via `queryClient.getQueryData(["instagram-preview", vendorId, normalizedHandle])` as `initialData`. The bulk hook already seeds this cache; this just makes the drawer use it without a flash.
   - Treat any cached row (even `stale`) as "show now"; the server function already returns the cached row immediately and only re-scrapes for staff. No server change needed.

5. **Background refresh stays as-is**
   - The bulk server function still runs and updates the React Query cache; if any preview changed, the strip re-renders silently.
   - Staff "Refresh" button behavior unchanged.

### Files touched
- `src/hooks/use-instagram-previews.ts` — add localStorage hydrate/persist, `placeholderData`, seed detail-cache `initialData`.
- `src/components/vendor/VendorInstagramPreview.tsx` — add skeleton state for "no cache yet but handle exists".
- (No server, schema, or route-loader changes.)

### Out of scope
- Changing scrape cadence, queue architecture, or DB schema.
- Server-side rendering of previews (would require auth-aware SSR; bigger change).
