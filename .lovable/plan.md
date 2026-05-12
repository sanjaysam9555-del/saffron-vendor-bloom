# Uniform Vendor Cards (Admin + Client)

Make every vendor card on `/admin` and `/client` render at the same height with the same internal section layout, regardless of which optional fields a vendor has.

## Goals

- All cards in the grid have identical overall height.
- Title, badges row, info block, Instagram strip, and footer all line up across cards.
- Long values truncate instead of pushing the layout.

## Section heights (both cards)

Each card becomes a vertical stack of fixed-height regions:

```text
Title + ratings   ~48px (2 lines max, line-clamp-2)
Badges row        ~28px (single line, overflow hidden)
Info block        ~96px (location + phone/IG/etc, reserved)
Instagram strip   ~96px (always rendered, empty placeholder when missing)
Footer / actions  pinned to bottom (mt-auto)
```

Implementation rules:
- Title: `line-clamp-2 min-h-[2.5rem]`.
- Badges row: `min-h-[1.75rem] flex-nowrap overflow-hidden`.
- Info block: wrapped in `min-h-[6rem]` container; each row truncates.
- Instagram strip: always-rendered wrapper with `min-h-[6rem]`. When no preview, render a muted placeholder (border + faint "No Instagram preview" hint) instead of `return null`.
- Footer (`VendorProjectAssigner` + buttons on admin, `ClientStatusSelect` + quote pills on client) stays pinned via existing `mt-auto`.

## File changes

1. `src/components/vendor/VendorCard.tsx` (admin)
   - Add `line-clamp-2 min-h-[2.5rem]` to `<h3>`.
   - Reserve `min-h-[1.75rem]` on the badges wrapper.
   - Wrap the info block (`location / phone / instagram / price`) in a `min-h-[6rem]` container.
   - Always render `<VendorInstagramCardStrip>` inside a `min-h-[6rem]` wrapper.

2. `src/components/client/ClientVendorCard.tsx`
   - Same title clamp.
   - Reserve `min-h-[1.75rem]` on the badges wrapper.
   - Wrap info block (`location / instagram / portfolio / website / rating`) in `min-h-[6rem]`.
   - Always render Instagram strip in a `min-h-[6rem]` wrapper.

3. `src/components/vendor/VendorInstagramPreview.tsx`
   - `VendorInstagramCardStrip`: instead of `return null` when `preview` is missing/empty, render a placeholder block (`<div className="mt-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-2 text-[10px] text-[var(--charcoal)]/40">No Instagram preview</div>`). Keep height consistent with the populated state.

## Out of scope

- No changes to data fetching, sorting, or grid container.
- No table view changes.
- No new design tokens.
