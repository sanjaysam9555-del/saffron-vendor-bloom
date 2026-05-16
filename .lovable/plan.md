## Problem

Vendor portfolios sometimes include videos (mostly `.mp4`, e.g. WhatsApp clips up to ~16 MB). Today:

- The file picker `accept` list (`ACCEPTED_FILE_TYPES` in `src/lib/vendor-files-api.ts`) does **not** list any video extensions, so video uploads only succeed via drag-and-drop or by typing the path. The 20 MB cap also rejects most real portfolio reels.
- When a video row is clicked, `DocumentViewer` classifies it as `"other"` and shows the "Preview not available" fallback. The "Open in new tab" link relies on a short-lived (5 min) signed URL; after it expires (or for clients without project access) the storage backend returns **"Object not found"**, which is what the user is seeing.
- Videos are never actually played inline.

## Goal

Let staff and clients **watch** vendor videos directly inside the document viewer (same modal flow as PDFs/images), and stop the misleading "object not found" surface.

## Changes

1. **`src/lib/vendor-files-api.ts`**
   - Extend `ACCEPTED_FILE_TYPES` with common video extensions: `.mp4, .mov, .webm, .m4v`.
   - Introduce a higher size limit for videos (e.g. `MAX_VIDEO_FILE_SIZE = 200 * 1024 * 1024`) while keeping the existing 20 MB limit for documents/images. Export a helper `maxFileSizeFor(file)` and update `VendorForm.addFiles` to use it.

2. **`src/components/vendor/DocumentViewer.tsx`**
   - Add a new `"video"` branch to `detectKind` (matches `video/*` MIME or `.mp4|.mov|.webm|.m4v|.mkv|.avi` extensions).
   - Add a `VideoView` component that renders a native `<video controls preload="metadata" playsInline>` element using the signed URL **directly** (no `fetch` → `blob:` round-trip; Supabase signed URLs already support `Range` requests which the browser needs for seeking).
   - Keep the existing PDF blob-fetch logic untouched so PDF previews are unaffected.

3. **`src/components/vendor/SignedDocumentViewer.tsx`**
   - When `getAttachmentUrl` rejects with a storage "object not found" / 404 message, show a friendlier copy ("This file is no longer available") instead of the raw error, and stop using "Loading…" indefinitely.

4. **`src/components/vendor/VendorForm.tsx`**
   - Use the new per-file size helper so video uploads above 20 MB are allowed up to the new video cap, and show a clearer error message when oversize.

## Out of scope

- No schema or RLS changes — storage paths, `vendor_attachments` table, and `getVendorFileSignedUrl` authorization logic stay as they are.
- No transcoding / thumbnail generation. The browser plays the original file.
- No changes to quote-file viewing (`SignedQuoteFileViewer`) unless needed; can mirror the same `VideoView` later if requested.

## Technical notes

- Supabase signed URLs over the `vendor-files` bucket return `206 Partial Content` for `Range` requests, so a plain `<video src={signedUrl} controls>` works for scrubbing without needing HLS.
- We deliberately do **not** download the whole video into a `blob:` URL (the way PDFs are handled) — that would force the entire file into memory before the first frame and break seeking on large clips.
- The viewer modal already locks `body` scroll and handles `Esc`; the video element inherits those behaviors.
