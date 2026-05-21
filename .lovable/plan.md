## What you'll see

Clicking an image in the Documents grid opens it in a full-screen viewer that:
- Fits the screen by default (no scroll, full image visible — `object-contain` instead of the current scrollable scaled wrapper).
- Shows **←** / **→** arrow buttons when the vendor has more than one image, plus a `2 / 5` counter.
- Supports keyboard arrows (← / →) and horizontal swipe on touch devices to move between images.
- Wraps around at the ends.
- Still supports zoom in/out and download for the current image.

Non-image attachments (PDF, video, doc) open exactly as today — single-file viewer, no nav.

## How it works

The grid currently opens `SignedDocumentViewer` for a single attachment. We'll add a sibling component, `AttachmentGalleryViewer`, that:
- Takes `attachments: AttachmentLike[]` + `initialId: string` + `onClose`.
- Filters the list to image attachments only (the gallery only makes sense for images).
- Tracks `currentIndex` in state.
- For each image, resolves its full signed URL via `getAttachmentUrl` (lazy — only fetches the current ± 1 neighbors to pre-warm).
- Renders the existing `<img>` zoom UI from `DocumentViewer.ImageView`, but with `object-contain max-h-full max-w-full` as the default fit (zoom defaults to 1, no overflow).
- Adds prev/next buttons (`ChevronLeft` / `ChevronRight`) along the left/right edges, only visible when more than one image exists.
- Listens for `ArrowLeft` / `ArrowRight` keys and `touchstart`/`touchend` for swipe (≥ 40 px horizontal delta).
- Resets zoom to 1 when the index changes.

Routing decision at the grid:
- If the clicked attachment is an image **and** the vendor has any image attachments, open `AttachmentGalleryViewer` with the full image list.
- Otherwise (PDF/video/doc) open `SignedDocumentViewer` as today.

## Files touched

- **New:** `src/components/vendor/AttachmentGalleryViewer.tsx` — full-screen image gallery (header with filename + counter + close/download, image area with prev/next + swipe, footer zoom controls).
- **Edit:** `src/components/vendor/AttachmentThumbnailGrid.tsx` — accept an optional `gallery` mode prop or, simpler, expose `onOpen(att, kind)` so the parent can decide which viewer to mount. Default: keep current `onOpen(att)` signature and add a second prop `images` so the parent can pass the list.
- **Edit:** `src/components/vendor/VendorDetail.tsx` — when `viewing` is an image and there's more than one image attachment, render `AttachmentGalleryViewer` with the image list; otherwise keep `SignedDocumentViewer`.
- **Edit:** `src/components/client/ClientVendorDetail.tsx` — same change as `VendorDetail.tsx`.

## Out of scope

- No changes to the grid layout, thumbnails, upload pipeline, or non-image file handling.
- No pinch-zoom gesture (existing +/- zoom buttons stay).
- No thumbnail strip at the bottom — counter only.
