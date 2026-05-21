# Make the app fast end-to-end

The app feels slow because the admin/client dashboards render every vendor at once, each card fires its own Instagram + booked + assignment queries, file thumbnails request signed URLs one-by-one (with a server-side HEAD probe per file), and most routes fetch after mount instead of preloading. Here is a targeted plan that fixes all of that without changing functionality.

## What you'll notice

- Dashboards paint in well under a second even with thousands of vendors.
- Instagram previews and file thumbnails stream in without the visible "one card at a time" cascade.
- Switching between Admin / Projects / Client / Vendor detail feels instant (data is preloaded on hover/intent).
- Opening files, attachments and the image gallery is near-instant on repeat visits.

## 1. Render only what's on screen (virtualization)

The dashboards currently mount every vendor card simultaneously. Each card runs an Instagram strip, project assigner, and booked badge — that's hundreds of subscriptions on first paint.

- Add `@tanstack/react-virtual` and virtualize:
  - `src/routes/admin.index.tsx` card grid and table view
  - `src/components/client/ClientVendorTable.tsx` and `ClientBoardView.tsx`
- Cards keep the same look; only off-screen items are skipped.

## 2. Stop the "cards updating one by one" Instagram cascade

`useAutoEnsureMissingPreviews` currently kicks off a scrape for every vendor in the list as soon as the page mounts.

- Gate auto-ensure behind an `IntersectionObserver` so we only scrape for vendors actually in the viewport (or about to be), in small concurrent batches (e.g. 4 at a time).
- Keep `localStorage` hydration (already in place) so revisits paint instantly.
- Add a short `staleTime` bypass: if the cached row is `ok`, never re-scrape on this load.

## 3. Batch + cache attachment thumbnails

Today every image tile calls `getVendorFileThumbnailUrl` individually, and the server fn does a HEAD probe before handing back a URL.

- New server fn `getVendorFileThumbnailUrlsBulk({ file_paths })` returns a `{ path: url }` map in one round-trip.
- Drop the HEAD probe — Supabase's signed transform URL already 404s cleanly; the probe doubles latency.
- Sign with a 1-hour TTL and bump React Query `staleTime` to 50 min so repeat opens are instant.
- `AttachmentThumbnailGrid` issues one `useQuery` keyed on the full path list instead of one per tile.

## 4. Preload route data on hover/intent

`defaultPreload: "intent"` is already on the router, but routes don't expose loaders, so hovering a link doesn't prefetch data.

- Add TanStack Query loaders to: `admin.index`, `admin.projects.index`, `admin.projects.$id`, `admin.submissions`, `client.index`, vendor detail drawers.
- Pattern: `loader: ({ context }) => context.queryClient.ensureQueryData(vendorsQueryOptions)` + `useSuspenseQuery` in the component.
- Wire `queryClient` into router context (`createRootRouteWithContext`) so loaders share the singleton cache.

## 5. Tune React Query + realtime

- Global defaults: `staleTime: 5 * 60_000`, `gcTime: 30 * 60_000`, `refetchOnWindowFocus: false`, `refetchOnReconnect: "always"`.
- Realtime vendor subscription currently invalidates the entire 2000-row list on any change. Patch the cache in place instead: for `INSERT/UPDATE/DELETE` payloads, mutate the cached array directly so we don't refetch everything.

## 6. Code-split heavy admin features

Split these out of the main admin bundle (dynamic `import()` + `React.lazy`):

- `BulkInstagramSyncDialog`, `BulkEditDialog`, `VendorForm`, `CategoryManager`, `VendorQuoteHistory`, `SignedDocumentViewer`, `AttachmentGalleryViewer`, `ProjectVendorQuotesPanel`, `VendorInstagramPreview` (detail strip).
- Only loaded the first time the user opens that dialog/route.

## 7. Cache the Instagram image proxy harder

`src/routes/api/public/instagram-image.ts` already sets `Cache-Control: public, max-age=86400`. Add:

- `immutable` and `stale-while-revalidate=604800` so the browser + Lovable edge keep them for a week.
- Stream upstream straight through (already done) but add `Vary: Accept` and a `Last-Modified` passthrough so 304s work on revisit.

## 8. Defer non-critical work past first paint

- Wrap `useAutoEnsureMissingPreviews` and `BookedBadge` bulk fetch in the existing `useIdleReady()` so they only run after the cards are painted.
- Lazy-mount `NotificationsBell` polling after idle.
- Use `content-visibility: auto` on virtualized rows for additional layout savings.

## 9. Image + asset hygiene

- Add `width`/`height` (or `aspect-ratio`) on every `<img>` in cards/grids to prevent CLS reflow.
- Add `fetchpriority="high"` to the LCP image of each route (vendor card hero/IG avatar on the first row), `loading="lazy" decoding="async"` on the rest (already partly done).
- Preload the Inter/display fonts already used in `__root.tsx`'s `head().links` with `rel=preload as=font crossorigin`.

## 10. Server function hot paths

- `listVendorsServer` runs 4 parallel queries returning up to 30k ids just to build 3 booleans per vendor. Replace with a single SQL view or RPC (`vendors_with_flags`) that returns `has_assignment / has_quote_history / has_attachment` as columns — one query instead of four, and tiny payloads.
- Add database indexes on `project_vendors(vendor_id)`, `project_vendor_quotes(vendor_id)`, `vendor_attachments(vendor_id)` if not present.

## Technical details

- New deps: `@tanstack/react-virtual`.
- New server fn: `getVendorFileThumbnailUrlsBulk` (POST, `requireSupabaseAuth`, input `{ file_paths: string[] }`, authorizes each path with the existing `authorizeVendorFile`).
- New RPC + migration: `vendors_with_flags()` (SECURITY DEFINER) + indexes on the three child tables.
- Router context change in `__root.tsx` to expose `queryClient`; route files add `loader` + `useSuspenseQuery`.
- Realtime handler in `useVendors` switches from `qc.invalidateQueries` to `qc.setQueryData` patching.
- All visual styling, components, and user flows stay identical — this is a perf-only change.

## Out of scope

- No design or copy changes.
- No new features.
- No changes to auth, RLS, or business logic.
- No swap of storage/backend providers.
