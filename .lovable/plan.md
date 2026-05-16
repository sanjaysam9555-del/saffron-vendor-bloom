# Symmetrical vendor cards on client dashboard

Tighten `src/components/client/ClientVendorCard.tsx` so every card in the grid shares the same vertical rhythm regardless of which optional fields a vendor has filled in. No other files touched.

## Asymmetries today

1. **Chip row** wraps to 2 lines when a subcategory is present, pushing every section below it down on those cards only.
2. **Info block** (location / instagram / portfolio / website / rating) has 0–5 lines depending on the vendor, so the Instagram strip and footer start at different Y positions on every card.
3. **Instagram strip** renders nothing when the vendor has no handle, but reserves `min-h-[148px]` when it does — cards without a handle visually "lose" that block.
4. **Footer block** sits flush against the last filled row (we removed `marginTop:auto` earlier), so cards with little content have their status select / View Details near the middle of the card while richer cards push it to the bottom.
5. **Quotes / attachments / comments row** is missing entirely on most cards and present on a few — when present it adds a line above View Details, shifting that button down.

## Fixes

All changes are presentation-only Tailwind tweaks inside `ClientVendorCard.tsx`.

- **Title**: keep `line-clamp-1` but switch to `min-h-[1.75rem]` so single-line titles still reserve the same height as wrapped ones across breakpoints.
- **Chip row**: keep `flex-wrap` (so nothing clips) but reserve `min-h-[1.5rem]` so a one-row chip set occupies the same height as a wrapped two-row set on neighbouring cards. Accept wrapping only on the cards that need it; the reserve normalises the rest.
- **Info block**: wrap each optional row (location, instagram, portfolio, website, rating) so the block always renders 5 slots. Missing rows render an invisible `aria-hidden` spacer with the same height (`h-[1.125rem]`) instead of being omitted. Drop `overflow-hidden`; keep `min-w-0 space-y-1.5`. Result: every card's info block is the same height and the Instagram strip starts at the same Y.
- **Instagram strip**: always reserve the slot. When the vendor has no handle, render a muted dashed placeholder of the same `min-h-[148px]` ("No Instagram linked") instead of returning `null`. This keeps the footer at the same Y across all cards. Implementation lives inside `ClientVendorCard` (a sibling wrapper around `VendorInstagramCardStrip`) so `VendorInstagramPreview.tsx` is untouched.
- **Footer**: re-introduce `mt-auto` on the footer block so it always pins to the card bottom now that the upper sections have stable heights. Combined with `h-full` on the card and the grid's row stretch, every footer aligns across a row.
- **Quotes / attachments / comments sub-row**: always render the row container with `min-h-[1.5rem]`; when there are no quotes/attachments/comments, render nothing inside but keep the row so the View Details button sits at a consistent Y.
- **Saffron's Pick badge** stays absolutely positioned (already doesn't affect layout).

## Out of scope

- The Instagram preview component itself (`VendorInstagramPreview.tsx`), the status select, quote chips' styling, View Details styling, grid/column counts in `client.index.tsx`, desktop vs mobile breakpoints (the changes apply at every size).
- No data, server, or query changes.
