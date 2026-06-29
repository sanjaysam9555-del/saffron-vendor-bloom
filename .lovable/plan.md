## 1. Translucent strip above the fixed header (iOS PWA)

**Cause:** `apple-mobile-web-app-status-bar-style` is set to `black-translucent` in `src/routes/__root.tsx`. iOS then renders the status bar as a dark translucent overlay sitting on top of whatever is behind the body's `safe-area-inset-top` padding — which is the bare HTML background, not the cream header. That produces the grey band visible in the screenshot.

**Fix:** Make the area behind the status bar a solid cream so it merges seamlessly with the header.

- In `src/routes/__root.tsx`, change `apple-mobile-web-app-status-bar-style` from `black-translucent` to `default`. iOS then uses `theme-color` (`#F5F0E8`, already cream) to paint the status-bar background as a solid strip flush against the header.
- Keep `viewport-fit=cover` and the existing safe-area body padding so nothing else shifts.
- No CSS changes needed; the cream `body`/`html` background already covers the inset region.

## 2. Instagram previews go blank after applying a filter

**Cause:** Each page that renders vendor cards calls `useInstagramPreviewsBulk(ids)` with `ids` derived from the **filtered** vendor list. When the user toggles a filter, the `vendorIds` array changes → the React Query key `["instagram-previews-bulk", sortedKey]` changes → a brand-new query runs. For that new key:

- `initialData` only hydrates from localStorage; vendors whose previews were just successfully fetched moments ago under the previous key haven't been written to LS yet (or LS missed them), so `isLoading` flips to `true`.
- The parent passes `previewsLoading ? undefined` to each card, which puts every card into the skeleton state — matching exactly what the screenshot shows.
- It also triggers another server-fn call, burning tokens for data we already have in memory.

**Fix — make the bulk query stable across filtering:** fetch previews once for the **full vendor list** on each page, then look up per-card from the resulting map. Filtering becomes a pure UI operation; no refetch, no skeletons, no extra tokens.

Files to change (same pattern in each):

1. `src/routes/admin.index.tsx`
   - Move the `useInstagramPreviewsBulk` and `useBookedSummaryBulk` calls from the inner `VendorCardGrid`/table wrappers up to the parent component that owns the unfiltered `vendors` array.
   - Pass the resulting `previewMap` (and `previewsLoading`) down as props to both the grid and table wrappers, so the same map is shared between view modes.
   - In the card renderer, keep using `previewMap.get(v.id) ?? null` but stop gating it on `previewsLoading` once the map has any entries — only show the skeleton on the very first load when the map is empty.

2. `src/routes/client.index.tsx` — same refactor: hoist the bulk hook to use the full client vendor list, not the filtered one.

3. `src/routes/admin.projects.$id.index.tsx` — `igVendorIds` is already derived from the project's full vendor set, but verify it's not being recomputed from a filtered list; if it is, switch it to the unfiltered source.

4. `src/routes/admin.projects.$id.preview.$clientId.tsx` — same audit; ensure `igIds` is built from the full project vendor list, not a filtered subset.

5. `src/hooks/use-instagram-previews.ts` — small hardening so this never regresses:
   - In `useInstagramPreviewsBulk`, when computing `initialData` for a new key, also merge from any other active `["instagram-previews-bulk", …]` query caches (not just LS). This way, even if a caller does pass a changing id list, the previously-fetched rows are reused instantly with zero network calls.
   - Write rows to LS eagerly inside `queryFn` (already done) and also after `patchBulkCaches` (already done) — no behavior change, just confirm.

**Result:** Toggling filters keeps the existing Instagram previews on screen instantly, no skeleton flash, and no additional server-fn / scraper calls.

## Out of scope

- No changes to scraper logic, image cache bucket, or server functions.
- No visual redesign of the cards or header.
