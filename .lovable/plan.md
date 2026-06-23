## Problem

On the project's Assigned Vendors page (mobile), two issues appear in the screenshot:

1. The vendor cards (and their Instagram thumbnail strip) extend past the right edge of the screen, causing horizontal page scroll.
2. The Instagram preview grid stays blank — only empty grey tiles render, never the actual profile/thumbnails.

## Root causes

1. **Overflow:** `VendorInstagramCardStrip` uses `grid grid-cols-3` whose `<a>` cells have no `min-w-0`. CSS grid items default to `min-width: auto`, which for cells containing `<img>` resolves to the image's intrinsic width. Large Instagram CDN images push each cell to its natural width (hundreds of px), the row blows past the card, and the card pushes past the viewport.
2. **Missing previews:** `useInstagramPreviewsBulk` only returns rows that already exist in `vendor_instagram_previews`. The hook that fires background scrapes for vendors with handles but no cached row — `useAutoEnsureMissingPreviews` — is defined in `src/hooks/use-instagram-previews.ts` but is **not called from any page**, so on this route vendors that have never been scraped stay forever blank.

## Fix

### 1. Stop the strip from forcing card width
In `src/components/vendor/VendorInstagramPreview.tsx` (both the card strip at ~line 108 and the detail block at ~line 220):
- Add `min-w-0` to the `grid grid-cols-3` container.
- Add `min-w-0` to each `<a>` grid cell.
- Add `overflow-hidden` to the outer strip wrapper (`min-h-[148px] rounded-md …`) as a belt-and-suspenders guard so a misbehaving child can never push the card wider.

### 2. Auto-fetch missing previews on the assigned-vendors page
In `src/routes/admin.projects.$id.index.tsx` (the `AssignedVendorsSection` where `useInstagramPreviewsBulk` is already called, ~line 778):
- Import `useAutoEnsureMissingPreviews` from `@/hooks/use-instagram-previews`.
- Build the lightweight `{ id, instagram_handle }[]` list from `vendors` (memoised) and pass it together with `instagramPreviewMap` to `useAutoEnsureMissingPreviews(...)`. The hook already debounces with `requestIdleCallback`, caps concurrency at 6, dedupes in-flight ids, and patches the bulk cache on success, so no further wiring is needed.

That's it — the strip stops blowing out the card, and any vendor with a valid Instagram handle gets a preview scraped in the background and the strip refreshes itself.

## Out of scope

- Group view and Table view vendor-name click-through to a project-scoped detail page — already shipped earlier.
- Visual redesign of the strip (sizes, columns, captions) — unchanged.
- Backfill of vendors with invalid handles (Google Drive links etc.) — already filtered by `isValidInstagramHandle`.
