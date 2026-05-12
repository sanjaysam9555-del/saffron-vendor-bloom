## Goal

**Add** an Instagram profile preview (avatar + 3 most recent post thumbnails + bio snippet) to the existing vendor cards and detail drawer. The current text + icons layout stays exactly as it is — the IG preview is appended, not a replacement.

## Approach (the bulletproof part)

Instagram blocks anonymous scraping aggressively. To avoid flaky cards:

1. **Firecrawl handles the scrape** — rotating IPs, JS rendering, anti-bot bypass.
2. **Scrape once, cache in our DB** — cards never wait on Firecrawl at view time.
3. **Refresh on demand** — admin "Refresh preview" button on the detail drawer; auto-refresh entries older than 30 days on next view; re-scrape automatically when a vendor's `instagram_handle` changes.
4. **Graceful fallback** — if scrape fails, returns nothing, or the vendor has no `instagram_handle`, the card simply renders as it does today. No empty boxes, no broken images, no blocking spinners on the grid.

## Database

New table `vendor_instagram_previews`:

```text
vendor_id        uuid  PK / FK -> vendors.id (on delete cascade)
handle           text  (normalized handle that was actually scraped)
avatar_url       text  null
display_name     text  null
bio              text  null
followers_text   text  null   ("12.4K followers" — IG ships text, easier than parsing)
post_thumbnails  text[] null  (top 3 image URLs)
profile_url      text  null
status           text  not null  -- 'ok' | 'not_found' | 'error'
last_error       text  null
fetched_at       timestamptz not null default now()
updated_at       timestamptz not null default now()
```

RLS: staff (admin/employee) full access; clients can SELECT only for vendors they can already view (mirrors `client_can_view_vendor`).

## Connector

Use the **Firecrawl** connector. The user will be prompted once during implementation to link a Firecrawl connection; it injects `FIRECRAWL_API_KEY` server-side.

## Server functions (`src/lib/instagram-preview.functions.ts`)

- `getVendorInstagramPreviewsBulk({ vendorIds })` — read cached previews for the visible grid in one round-trip; queues a background refresh for stale rows (>30d) or rows with status='error'.
- `refreshVendorInstagramPreview({ vendorId })` — staff-only force re-scrape via Firecrawl, parse JSON response with a strict Zod schema, upsert.

Server-only helper `instagram-preview.server.ts` calls Firecrawl with `formats: [{ type: 'json', schema }]` and a prompt scoped to "the public Instagram profile page; return null fields if blocked or private."

## UI changes (additive only)

### Admin `VendorCard.tsx`
- Keep the entire existing card body unchanged.
- **Append** a small Instagram preview strip below the contact rows (above the action buttons / project assigner): round avatar + display name + bio truncated to one line + a 3-thumbnail row.
- Renders only when a cached preview with status='ok' exists. Otherwise nothing is added — current card looks identical.

### Client `ClientVendorCard.tsx`
- Same additive strip in the same position. (Vendor price stays hidden as before.)

### Admin `VendorDetail.tsx` and `ClientVendorDetail.tsx`
- **Append** a larger "Instagram" section after the existing fields: avatar, display name, bio, followers text, 3-thumb grid, "Open on Instagram" button.
- Admin-only: small "Refresh preview" button calling `refreshVendorInstagramPreview`.
- If no preview cached yet but a handle exists, show a subtle "Preview loading…" placeholder with a manual fetch button (admin) — never blocks the rest of the drawer.

All thumbnails use `loading="lazy"`, `referrerPolicy="no-referrer"`, and an `onError` that hides the broken image so a stale CDN URL never leaves a hole.

## Out of scope

- Removing or restyling any existing fields, icons, or rows on the cards.
- Storing IG images in our own bucket (we hotlink the IG CDN; can add a proxy later if hotlinks get blocked).
- Reels / video previews.
- Per-user OAuth or the official IG Graph API.
- IG previews on any non-vendor surface.

## Implementation order

1. Link Firecrawl connector (user prompt).
2. Migration: create `vendor_instagram_previews` + RLS + cascade FK.
3. Server helpers + 2 server functions.
4. Shared `<VendorInstagramPreview variant="card" | "detail" />` component.
5. Append into `VendorCard`, `ClientVendorCard`, `VendorDetail`, `ClientVendorDetail` — no other lines touched.
6. QA: vendor with handle (cached), vendor with handle (cold cache), vendor with no handle, vendor with private/invalid handle (fallback path), admin "Refresh" button.