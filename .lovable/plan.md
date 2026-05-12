## Problem

Firecrawl explicitly does not support instagram.com — every scrape returns: *"We apologize for the inconvenience but we do not support this site."* That is why every vendor preview is stuck on "Couldn't fetch preview right now."

## Fix: Replace Firecrawl with Apify Instagram Profile Scraper

Apify's `apify/instagram-profile-scraper` actor returns avatar, bio, follower count, and recent posts as structured JSON. It runs server-side, supports synchronous calls (`run-sync-get-dataset-items`) so we can keep the current request-time flow without adding a queue.

### 1. Secret

Add `APIFY_API_TOKEN` via the secrets tool. The user creates a token at apify.com → Settings → Integrations.

### 2. Server scrape rewrite (`src/server/instagram-preview.server.ts`)

- Drop `@mendable/firecrawl-js` dependency from this file.
- Call Apify:
  ```
  POST https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=...
  body: { "usernames": ["<handle>"] }
  ```
- Map the first result item to our schema:
  - `avatar_url` ← `profilePicUrlHD` || `profilePicUrl`
  - `display_name` ← `fullName`
  - `bio` ← `biography`
  - `followers_text` ← format `followersCount` (e.g. `12.4K followers`)
  - `post_thumbnails` ← first 3 of `latestPosts[].displayUrl`
- Treat `private: true` or missing posts as `not_found`.
- Keep the existing Zod validation, status enum, and 300-char `last_error` truncation so the DB column shape and existing UI states (`ok` / `not_found` / `error`) stay unchanged.

### 3. No changes needed to

- `vendor_instagram_previews` table schema
- `instagram-preview.functions.ts` (server fn signatures, caching, refresh button)
- `VendorInstagramPreview.tsx` and the four card/detail integrations
- Hooks and admin/client routes

### 4. Cleanup

- Remove `@mendable/firecrawl-js` from `package.json` (no other code uses it).
- Leave the Firecrawl connector linked in case the user wants it for future non-IG scrapes; just stop calling it.

### 5. Image hotlinking note

Instagram CDN URLs returned by Apify are time-signed and expire after a few days. Existing thumbnails use `referrerPolicy="no-referrer"` and graceful `onError`, which already handles expiry — the staff "Refresh preview" button regenerates fresh URLs. No new infra needed for v1.

### 6. Verification

After deploy: open one vendor with a public IG handle, click Refresh, confirm avatar + 3 thumbnails render, then check the grid card shows the same. Confirm a private/invalid handle stores `status='not_found'` rather than `error`.

## Out of scope

- Background queue / cron refresh (current synchronous flow is fast enough; Apify sync endpoint typically returns in 5–20s).
- Re-hosting IG images in our own bucket.
- Replacing the existing text/icon vendor card content — preview remains additive only.
