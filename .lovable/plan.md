# Add Prev/Next Navigation in Vendor Detail Modals

When a user opens the detailed vendor view from any thumbnail/card/table list, add left/right arrow buttons so they can step through vendors without closing the modal.

## Scope

Two detail modals, each opened from multiple places:

1. **Admin** — `src/components/vendor/VendorDetail.tsx`
   - Opened from: `src/routes/admin.index.tsx` (main vendor library) and `src/routes/admin.projects.$id.index.tsx` (project's vendor views).
2. **Client** — `src/components/client/ClientVendorDetail.tsx`
   - Opened from: `src/routes/client.index.tsx` and `src/routes/admin.projects.$id.preview.$clientId.tsx`.

## Behavior

- Two circular arrow buttons floating on the left and right edges of the modal (outside the card on desktop, inside on mobile).
- "Previous" and "Next" cycle through the **same visible/filtered list** the user is currently looking at (so filters, sorting, and search are respected).
- Disabled (greyed out) at the first/last vendor — no wrap-around.
- Keyboard support: `←` / `→` while the modal is open. `Esc` continues to close.
- A small "X of Y" counter sits next to the close button in the header.
- Navigation simply swaps the vendor in the existing modal — no close/reopen flicker.

## Technical Notes

- Extend each modal's props with `vendors: Vendor[]` (the ordered, filtered list currently shown) plus `onNavigate: (vendor) => void`. Keep `vendor`/`onClose` as today.
- At each call site, pass the same array that drives the cards/table/thumbnails (e.g. `filteredVendors`, `vendors` returned by the query/filter pipeline) so prev/next matches what the user sees.
- Inside the modal, derive `index = vendors.findIndex(v => v.id === vendor.id)` and compute `prev`/`next`. Wire arrow buttons + a `useEffect` keydown listener on `ArrowLeft`/`ArrowRight` to call `onNavigate(prev|next)`.
- Reset any internal modal state (e.g. delete-confirm, currently viewed attachment) when the vendor id changes.
- No backend, query, or data-shape changes.

## Files Touched

- `src/components/vendor/VendorDetail.tsx` — add nav buttons, counter, keyboard handler, prop changes.
- `src/components/client/ClientVendorDetail.tsx` — same.
- `src/routes/admin.index.tsx` — pass filtered vendor list + `onNavigate`.
- `src/routes/admin.projects.$id.index.tsx` — same for thumbnail/table/board openers.
- `src/routes/client.index.tsx` — pass filtered client-vendor list + `onNavigate`.
- `src/routes/admin.projects.$id.preview.$clientId.tsx` — same.

## Out of Scope

- No changes to filters, sorting, or list rendering.
- No swipe gestures on touch (can add later if desired).
- Board view's drag-and-drop card flow is untouched; only its detail modal gains nav.
