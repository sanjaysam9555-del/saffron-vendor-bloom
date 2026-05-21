## 1. Remove "Copy Contact Card"

In `src/components/vendor/VendorDetail.tsx`:
- Remove the `copyContactCard` handler, the `copiedCard` state, and the button at line ~214 (used in both admin and client because this component is shared).
- Clean up unused imports (`Copy`/`Check` icon, etc.) if no longer referenced.

No other usages exist (`rg "Copy Contact Card"` only matches this file).

## 2. Fix Instagram previews that stay blank for valid handles

Symptom: vendors with a working IG link never show a preview, even after multiple refreshes. Root causes in the current code:

- `ensureVendorInstagramPreview` only re-scrapes when the cached row is `stale` or `status === "error"`. Rows cached as **`not_found`** (which is what the scraper returns when Apify gives back an empty item, a private/blocked profile, or no avatar+thumbs) are never refreshed — so once a handle lands in that bucket it stays blank forever.
- `scrapeInstagramProfile` downgrades a valid `ok` Apify response to `not_found` whenever `avatar_url`, `display_name`, and `thumbs` are all empty. The Apify actor occasionally returns a thin payload for real profiles, locking them into `not_found`.
- The Apify call is made once with no retry; transient 5xx/empty responses also stick.
- The manual "Refresh" button works against the cache, but the UI in `VendorInstagramDetailBlock` only shows it inside the "no preview" panel — easy to miss, and it just hits the same single-shot scrape.

### Server-side changes

`src/server/instagram-preview.server.ts`
- Add one retry (≈1.5 s backoff) around the Apify `fetch` when the response is non-OK or returns zero items.
- Stop converting `ok` responses with missing media to `not_found`. Persist whatever fields we do have (handle + profile_url) with `status: "ok"` so the UI can render the link-only state; only mark `not_found` when Apify explicitly says the profile doesn't exist.

`src/server/instagram-preview.functions.ts`
- In `ensureVendorInstagramPreview`, treat `status === "not_found"` the same as `error` for re-scrape eligibility (staff only). Add a short cooldown (e.g. 10 min since `fetched_at`) to avoid hammering Apify on every page load.
- Keep client behavior unchanged (read-only).

### UI changes

`src/components/vendor/VendorInstagramPreview.tsx`
- Render available data (handle, profile link, avatar if any) whenever `status === "ok"`, even without thumbnails.
- Always show the "Refresh" button (for staff) in the header, not only inside the empty state, so admins can recover stuck rows in one click.

### Out of scope

- No schema changes.
- No changes to the `/api/public/instagram-image` proxy route.
- No change to the client-side hooks/cache shape.

## Files touched

- `src/components/vendor/VendorDetail.tsx`
- `src/server/instagram-preview.server.ts`
- `src/server/instagram-preview.functions.ts`
- `src/components/vendor/VendorInstagramPreview.tsx`
