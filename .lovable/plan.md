# Card height polish

Two specific issues with the uniform-card layout:

1. **Instagram strip is clipped** — the strip is locked to `h-[96px]` but the actual content (avatar row + 3 thumbnail squares) needs ~140–150px at the current card width, so the bottom of the thumbnails is cut off and the "No Instagram preview" placeholder makes the card slightly shorter than ones with real previews.
2. **Empty space under the vendor name** — the title reserves `min-h-[2.5rem]` to allow 2 lines, so single-line names leave a visible gap above the badges.

## Fixes

### 1. Right-size the Instagram strip
In `src/components/vendor/VendorInstagramPreview.tsx` → `VendorInstagramCardStrip`:
- Replace `h-[96px] overflow-hidden` with `min-h-[148px]` (no overflow clip) on both the populated and placeholder branches so the 3-up thumbnail grid is fully visible and both states match in height.
- Keep the placeholder branch (`No Instagram preview`) at the same `min-h-[148px]` so cards with and without previews stay equal.

### 2. Tighten the title block
In `src/components/vendor/VendorCard.tsx` and `src/components/client/ClientVendorCard.tsx`:
- Change the `<h3>` from `line-clamp-2 min-h-[2.5rem]` to `line-clamp-1` and drop the `min-h-*`. Single-line truncation removes the gap and still keeps every card's title row identical in height.
- Add `truncate` semantics by relying on `line-clamp-1` (no extra wrappers needed).

That's it — no other layout changes, no token changes, no behavior changes.

## Files

- `src/components/vendor/VendorInstagramPreview.tsx` — strip height + remove overflow clip.
- `src/components/vendor/VendorCard.tsx` — title clamp.
- `src/components/client/ClientVendorCard.tsx` — title clamp.
