## Goal
On the **Viewing as client — read-only preview** page, show the Instagram previews already cached by the Vendor Dashboard instead of re-fetching from the scraper (which is currently rate-limited and returns empty error rows).

## Why the previews look empty today
- The Vendor Dashboard previously scraped and cached working Instagram previews for these vendors (avatar, name, 3 thumbnails) in the database, the in-memory query cache, and `localStorage`.
- A later refresh hit the scraper's monthly limit and overwrote those database rows with `status: error` (no avatar, no thumbnails).
- The client preview page reads only the bulk server result, so it now sees the error rows and renders "No Instagram preview" — even though the older successful preview is still sitting in the browser cache / localStorage.

## Plan
1. **Prefer cached good previews over server error rows (client side)**
   In `src/hooks/use-instagram-previews.ts` (`useInstagramPreviewsBulk`):
   - After receiving the server response, for each vendor whose returned row is `status: "error"`, look up a prior successful (`status: "ok"`) preview from:
     1. The per-vendor query cache (`["instagram-preview", vendorId, handle]`)
     2. Any other active bulk cache entry (`["instagram-previews-bulk", ...]`)
     3. `localStorage` (`saffron.ig.previews.v1`)
   - If a cached `ok` row exists, substitute it into the returned map so cards render the cached avatar + thumbnails.
   - Do **not** write the substituted rows back to the DB; this is a UI-only fallback.

2. **Stop overwriting good DB rows with scraper errors (server side)**
   In `src/server/instagram-preview.functions.ts` (`upsertPreview`):
   - Confirm the existing guard "if scrape failed and we have an ok row, keep the ok row" stays in place so future refreshes don't blank out working previews again.

3. **Skip auto-refresh while previews exist in cache**
   In `useAutoEnsureMissingPreviews`:
   - Treat a vendor as "already has a preview" when either the server map or the resolved cached map contains an `ok` row, so the preview page does not keep triggering scrape attempts (which currently fail and waste calls).

4. **Verify**
   - Reopen `/admin/projects/.../preview/<clientId>` as the same admin who has already loaded the Vendor Dashboard.
   - Confirm each Instagram-linked vendor card shows the cached preview (avatar, name, thumbnails) instead of "No Instagram preview."
   - Check the network panel: no new `ensureVendorInstagramPreview` calls fire for vendors that already have a cached `ok` row.

## Technical details
- Files touched:
  - `src/hooks/use-instagram-previews.ts` — merge cached `ok` rows over server `error` rows; gate auto-ensure on resolved map.
  - `src/server/instagram-preview.functions.ts` — keep the "don't overwrite ok with error" guard.
- No schema changes.
- No auth/role changes.
- Caveat: a vendor that has never been previewed on the Vendor Dashboard (no cache entry anywhere) will still show the empty state until the scraper limit is restored — there is no other source of truth for thumbnails.