## Remaining performance work

The previous turn shipped quick wins (query tuning, batched thumbnails, Instagram proxy caching, idle background sync). This plan covers the heavier refactors still outstanding from the original 10-point plan.

### 1. Virtualize long vendor lists
- Add `@tanstack/react-virtual`.
- Apply to: `src/routes/admin.index.tsx` (vendor table/grid), `src/components/client/ClientVendorTable.tsx`, `src/components/client/ClientBoardView.tsx`.
- Only render rows/cards in the viewport (+ small overscan). This alone removes the "hundreds of cards mount at once" cost that triggers the per-card query cascade.

### 2. Gate per-card side queries behind visibility
- Wrap `VendorInstagramPreview`, `BookedBadge`, attachment thumbnails, and any per-vendor query in an `IntersectionObserver` hook (`useInView`).
- Queries only fire when the card actually scrolls into view.
- Combined with virtualization, first paint drops from "N vendors × 3 queries" to "visible vendors × 3 queries".

### 3. Route-level data preloading
- Convert `admin.index`, `admin.projects.$id`, `client.index`, and vendor detail routes to the canonical TanStack pattern: `loader: ({ context }) => context.queryClient.ensureQueryData(...)` + `useSuspenseQuery` in the component.
- Enable `defaultPreload: "intent"` on the router so hovering a link warms the cache.
- Result: navigating between pages feels instant; no "blank then pop" flashes.

### 4. Code-split heavy dialogs and viewers
Lazy-load with `React.lazy` + Suspense:
- `BulkInstagramSyncDialog`
- `BulkEditDialog`
- `VendorForm`
- `CategoryManager`
- `SignedDocumentViewer`
- `AttachmentGalleryViewer`
- `ProjectVendorQuotesPanel`
Shrinks the main admin bundle so first paint and route transitions are quicker.

### 5. Patch realtime updates in place
- In the vendor realtime subscription, stop calling `queryClient.invalidateQueries` for the whole list on every change.
- Instead, use `queryClient.setQueryData` to mutate the single affected row in cache.
- Eliminates the full 2000-row refetch on any edit.

### 6. Image hygiene pass
- Add explicit `width`/`height` (or `aspect-ratio`) on all `<img>` to prevent layout shift.
- `fetchpriority="high"` on the LCP image of each route.
- `loading="lazy" decoding="async"` on offscreen images.
- Preload the primary brand font in `__root.tsx` head.

### 7. Defer non-critical mounts
- Wrap `NotificationsBell` and any "nice-to-have" widgets in an idle/intersection-gated mount so they don't compete with the first paint.

### Out of scope
- No design changes, no auth/RLS changes, no business-logic changes.
- No backend provider swap.
- The `vendors_with_flags` SQL view from the original plan is parked — the existing indexes plus virtualization + visibility gating should make the current `listVendorsServer` fast enough. Revisit only if profiling still shows it as the bottleneck after the above.

### Expected impact
- Admin index first paint: large drop (only ~15 visible rows mount instead of all).
- Navigation between pages: near-instant via preload + cached query data.
- Edits / realtime updates: no full-list refetch.
- Bundle size for the main route: meaningfully smaller via lazy dialogs.