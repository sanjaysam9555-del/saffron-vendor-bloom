## Problem

The grid loads images via signed URLs that point to the originals — a 6 MB JPEG stays 6 MB even when shown in a ~200 px tile. The fix has two parts: **shrink new uploads** at the browser before they reach storage, and **render thumbnails at thumbnail size** for everything (new + existing) so the grid stops downloading multi-MB originals.

## 1. Client-side image compression on upload (new files)

In `src/lib/vendor-files-api.ts`, add a `compressImageIfNeeded(file)` helper called inside `uploadVendorAttachment` before the storage upload.

- Applies to `image/jpeg`, `image/png`, `image/webp` only. PDFs/videos/docs pass through untouched.
- Uses `createImageBitmap` + `<canvas>` + `canvas.toBlob("image/webp", 0.82)`.
- Max dimension **2000 px** on the longest side (preserves quality for the full-screen viewer).
- Skips compression if the result is larger than the original or if the source is already < 400 KB.
- Renames the stored file to `.webp` when re-encoded; original `file_name` (display) keeps its extension so the user still sees `IMG_9137.jpeg` in the UI, while storage holds the compressed WebP — `mime_type` and `size_bytes` reflect the compressed blob.

This drops typical phone photos from 4–6 MB to ~200–400 KB with no visible quality loss in the panel or full viewer.

## 2. Thumbnail rendering for the grid (covers existing files too)

Storage URLs from Supabase support on-the-fly image transforms. In `AttachmentThumbnailGrid.tsx`'s `ImageTile`, switch to a thumbnail-sized signed URL instead of the full-size one.

- Add `getAttachmentThumbnailUrl(filePath, { width, height, quality })` in `vendor-files-api.ts` that calls a new server fn `getVendorFileThumbnailUrl` (mirrors `getVendorFileSignedUrl`) which uses `supabaseAdmin.storage.from("vendor-files").createSignedUrl(path, 3600, { transform: { width: 400, height: 400, resize: "cover", quality: 70 } })`.
- `ImageTile` requests width/height **400** (≈ 2× the grid tile for retina). Falls back to the full signed URL on transform error so the tile still renders.
- The full-screen `SignedDocumentViewer` keeps using the existing non-transformed URL, so opening still shows the high-res image.

This immediately speeds up the grid for the legacy 6 MB / 16 MB files already in the bucket — no re-upload required.

## 3. Tile UX while loading

- Add `loading="lazy"` and `decoding="async"` (already lazy; add `decoding`).
- Keep the `animate-pulse` placeholder until the thumbnail resolves.
- No change to videos — `preload="metadata"` is already the right call.

## Out of scope

- No server-side reprocessing of existing originals (the transform CDN handles display; originals stay as-is for full-view fidelity).
- No video transcoding (would need ffmpeg / a worker; out of scope for a quick fix).
- No PDF page-image rendering.
- No schema changes, no bucket changes, no RLS changes.

## Files touched

- `src/lib/vendor-files-api.ts` — add `compressImageIfNeeded`, wire into `uploadVendorAttachment`, add `getAttachmentThumbnailUrl`.
- `src/server/vendor-files.functions.ts` — add `getVendorFileThumbnailUrl` server fn (transform-enabled signed URL).
- `src/components/vendor/AttachmentThumbnailGrid.tsx` — `ImageTile` uses the thumbnail URL with full-URL fallback.
