The previous turn proposed thumbnail grids but never wrote the code — `AttachmentThumbnailGrid.tsx` doesn't exist, and both `VendorDetail.tsx` and `ClientVendorDetail.tsx` still render the old `<ul>` of filename rows. This plan actually ships the change.

## What you'll see

- Documents section becomes a responsive grid of preview tiles (2 cols on mobile, 3 on tablet, 4 on desktop within the narrow side panel).
- **Images** show the actual image as a thumbnail (signed URL fetched lazily).
- **Videos** show the first-frame poster via `<video preload="metadata">` with a play-icon overlay.
- **PDFs / docs / other** show a file-type icon tile with the extension badge (no remote fetch — keeps the panel fast and avoids rendering PDFs as images).
- Clicking any tile opens the existing `SignedDocumentViewer` exactly as before.
- Filename + size sit under each tile in a 2-line footer.

## Files

**New:** `src/components/vendor/AttachmentThumbnailGrid.tsx`
- Props: `attachments`, `onOpen(att)`.
- One `<TileImage>` / `<TileVideo>` / `<TileFile>` per attachment, picked by mime type.
- `TileImage` and `TileVideo` use `useQuery` keyed on `file_path` with `staleTime: 5 * 60_000` to fetch the signed URL once per session.
- Grid classes: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`.
- Each tile is a `<button>` with `aspect-square` thumbnail area + caption.

**Edited:** `src/components/vendor/VendorDetail.tsx`
- Replace the existing `<ul>…vendor.attachments.map…</ul>` block with `<AttachmentThumbnailGrid attachments={vendor.attachments} onOpen={setViewing} />`.

**Edited:** `src/components/client/ClientVendorDetail.tsx`
- Same replacement for the client-side attachments `<ul>`.

## Out of scope

- No upload, RLS, viewer, or data-shape changes.
- No PDF first-page rendering (clicking the PDF tile still opens the full PDF in the viewer).
- No changes to the quote-file lists (those remain as filename rows).
