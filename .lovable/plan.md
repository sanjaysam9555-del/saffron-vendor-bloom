## Issues

1. **Banner overlap on scroll** — `/admin/projects/$id/preview/$clientId` is nested under the `/admin` layout, which renders `AdminShellHeader` as `sticky top-0 z-30`. The preview page also renders its banner as `sticky top-0 z-30`, so on scroll both pin to the top and visually collide.
2. **Instagram previews missing** — the preview page renders `ClientVendorCard` but never fetches Instagram previews, so `instagramPreview` is always undefined. The real client view (`client.index.tsx`) uses `useInstagramPreviewsBulk` + `useAutoEnsureMissingPreviews` and passes `previewMap.get(v.id)` to each card.

## Fix

In `src/routes/admin.projects.$id.preview.$clientId.tsx`:

- **Banner**: drop `sticky top-0 z-30` from the "Viewing as client — read-only preview" bar so it scrolls with the page (the admin shell header stays as the only sticky element on top). Keep styling otherwise unchanged.
- **Instagram**: mirror the pattern from `ClientVendorGrid` in `client.index.tsx`:
  - Build `ids = vendors.filter(v => v.instagram_handle).map(v => v.id)` via `useMemo`.
  - Call `useInstagramPreviewsBulk(ids)` and `useAutoEnsureMissingPreviews(vendors, previewMap)` from `@/hooks/use-instagram-previews`.
  - Pass `instagramPreview={previewMap.get(v.id) ?? null}` to each `ClientVendorCard`.

No changes to `ClientVendorDetail` (it fetches its own preview), no schema changes, no shared layout changes.
