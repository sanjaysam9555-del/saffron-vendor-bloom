## Goal
Make the admin/client vendor lists feel instant with 450+ vendors (and scale to thousands), keeping the single infinite-scroll UX — no pagination, no "Load more" buttons.

## Changes

### 1. True windowing with `@tanstack/react-virtual`
Replace the current "render in batches of 60 with a sentinel" pattern with real virtualization in:
- `src/routes/admin.index.tsx` (card grid + table view)
- `src/components/vendor/VendorTable.tsx`
- `src/routes/client.index.tsx` (card grid)
- `src/components/client/ClientVendorTable.tsx`

Only the ~15–20 rows in the viewport (plus a small overscan) stay mounted. Scrolling 450 or 4500 vendors costs the same. Keeps existing card/row visuals untouched.

### 2. Slim the initial payload (`listVendorsLite`)
In `src/server/vendors.functions.ts` (or wherever `listVendorsServer` lives), add a new lightweight server fn that selects only the fields the list view needs:
`id, vendor_name, category, subcategory, location, instagram_handle, saffron_rating, google_rating, price_text, date_added` + the existing flag columns (assignments / quotes / attachments counts).

Heavy fields (deliverables, quote_breakdown, remarks, long text) move to a `getVendorFull(id)` fn called only when the detail drawer opens. Expected JSON size reduction ~60–70%.

### 3. Server-side search / filter / sort
Move the search box, category filter, location filter, and sort to the server:
- Add `searchVendorsServer({ q, category, location, sort, cursor, limit })` returning `{ rows, nextCursor, total }`.
- Use Postgres `ilike` on `vendor_name`, `category`, `location`, `instagram_handle` for `q`.
- Keyset pagination (cursor on `date_added, id`) to support infinite scroll without OFFSET cost.
- Client uses `useInfiniteQuery` + virtualization — fetches the next page automatically when the virtualizer approaches the end. Debounce search input by 200ms.

This means the browser never holds more than the rows actually rendered + a small buffer. URL stays the same (no `?page=` params).

### 4. Thumbnail signing tied to the visible window
`AttachmentThumbnailGrid.tsx` and the per-card primary thumbnail already use `getVendorFileThumbnailUrlsBulk`. Tie the bulk sign call to the virtualizer's visible range instead of "all mounted cards", so we only request signed URLs for ~15 visible vendors at a time. Cache results keyed by `vendor_id` for 5 min (existing `staleTime`).

### 5. Keep Instagram previews idle-loaded
Already done in `use-instagram-previews.ts` (`requestIdleCallback`, 6 workers). With virtualization, the queue naturally shrinks because only visible vendors register.

### 6. Indexes (verify, add if missing)
Run a migration to ensure these exist (cheap, idempotent):
- `vendors (date_added DESC, id)` — keyset cursor
- `vendors (vendor_name text_pattern_ops)` — ilike prefix
- `vendors (category)`, `vendors (location)` — filter

If any are already present, the migration is a no-op.

## Out of scope
- Pagination UI / page numbers / "Load more" buttons
- Auth, RLS, business logic
- Any visual redesign — cards and tables look identical
- Realtime, backend provider, or AI changes

## Expected impact
- First paint: only ~15 visible rows render → DOM nodes drop from ~450×N to ~15×N
- Network: initial list response ~60–70% smaller; search no longer ships full dataset
- Scroll: constant cost regardless of total vendor count
- Typing in search: one debounced server query instead of filtering 450 objects in JS
- Memory: per-card subqueries (Instagram, thumbnails) scoped to visible window
