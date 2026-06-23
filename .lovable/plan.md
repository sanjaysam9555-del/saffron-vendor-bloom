## Why the previews are still blank

The grey/blank tiles in your screenshot are NOT a layout bug anymore — they're the image proxy serving a 1×1 transparent SVG fallback because the Instagram CDN URL it tried to fetch returned 403/404.

Walking the chain:

1. The Apify scrape returns raw `*.cdninstagram.com` URLs for the avatar and post thumbnails. Those URLs are signed and **expire within hours**.
2. We store those raw URLs in the `vendor_instagram_previews` table.
3. The card requests `/api/public/instagram-image?url=…`. That route refetches Instagram upstream; when the signature has expired Instagram answers 403 and the route returns a 1×1 SVG fallback.
4. Browser renders the SVG into the tile → blank cream square.
5. The "auto-ensure missing previews" hook I wired in last round can't recover from this: the server fn returns the existing row immediately if `status === "ok"`, regardless of how old the row is. So once an OK row is written, the URLs stay frozen until staff hits the manual Refresh button in the detail drawer.

That's why some tiles render (URL still within its TTL window) and the rest don't (signature already expired).

## Fix — persist the images, don't proxy short-lived URLs

Stop relying on Instagram's expiring CDN. At scrape time, download the avatar + the first 3 post thumbnails server-side and upload them to a dedicated public bucket on Lovable Cloud Storage, then store those permanent URLs in `vendor_instagram_previews`. Tiles render directly from Cloud Storage; no proxy, no expiry.

### 1. Storage bucket

Add a migration that creates a public `instagram-cache` bucket on Lovable Cloud Storage. Reads open to `anon`; writes restricted to `service_role` (the existing `vendor-files` bucket stays private and unchanged).

### 2. Image persistence helper

New `src/server/instagram-image-cache.server.ts`:

- `persistInstagramImage(vendorId, kind, sourceUrl)` — fetches the URL with the same Instagram-friendly headers the proxy already uses, validates content-type is `image/*` and size is sane (<2 MB), uploads to `instagram-cache/{vendorId}/{kind}-{shortHash}.jpg` via the admin Cloud client (`upsert: true`), and returns the public URL. Returns `null` on failure.
- `persistInstagramAssets(vendorId, scrape)` — runs `persistInstagramImage` for the avatar and each thumbnail in parallel, swaps the URLs in the scrape result with whatever persisted successfully (falls back to the original URL if one fails, so we never lose a partial preview).

### 3. Wire persistence into the upsert path

In `src/lib/instagram-preview.functions.ts`, before `upsertPreview(...)` writes the row, call `persistInstagramAssets(vendorId, scrape)` and use the rewritten URLs. This covers `refreshVendorInstagramPreview`, `ensureVendorInstagramPreview`, the bulk backfill batch, and `src/server/trigger-instagram-preview.server.ts`.

### 4. One-time refresh for vendors that already have OK rows with expired CDN URLs

The current `ensureVendorInstagramPreview` early-returns on `status === "ok"`. Relax that so:

- if `force === true`, always re-scrape;
- otherwise, if the existing `avatar_url` / first thumbnail still points at a `*.cdninstagram.com` / `*.fbcdn.net` host (i.e. the row predates the persistence fix), treat it as stale and re-scrape once.

Update `useAutoEnsureMissingPreviews` to also enqueue vendors whose cached row is OK but still points at a CDN host. That migrates existing rows the first time someone views them; no separate backfill is required, though staff can still run the bulk backfill for a faster sweep.

### 5. Proxy stays as a safety net

`/api/public/instagram-image` keeps working — old cached rows that haven't been re-scraped yet still flow through it until step 4 migrates them. The card component (`<SafeImg>`) already skips the proxy for non-Instagram hosts, so cached Cloud Storage URLs will load directly with no proxy hop.

## Out of scope

- Storing post captions, multi-image carousels, video previews — unchanged.
- Bandwidth/cost optimisation for storage (CDN front, image resizing) — can revisit later.
- Layout (already fixed in the previous turn).

## After this ships

- New scrapes write permanent Cloud Storage URLs from the first run.
- Existing OK rows with `*.cdninstagram.com` URLs get re-scraped the next time the assigned-vendors page loads them, then they too render from Cloud Storage.
- The blank tiles you're seeing on Moov N Groov With Jeet should disappear within the first reload after the fix is deployed.
