# Vendor File Attachments + Document Viewer

Allow uploading files (PDF, DOC, DOCX, images) when adding/editing a vendor, and view them inside a built-in document viewer launched from the vendor detail modal.

## What the user will see

**In the Add/Edit Vendor form**
- New "Attachments" section near the bottom.
- Drag-and-drop zone + "Choose files" button. Multiple files allowed.
- Each selected/uploaded file shows: filename, size, type icon, and a remove (×) button.
- Existing attachments (when editing) are listed with the same controls.
- Accepted: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, JPG, PNG, WEBP. Max 20 MB per file.

**In the Vendor Detail modal**
- New "Documents" section listing every attachment with file icon + name + size.
- Clicking a file opens a full-screen document viewer overlay.

**Document Viewer (new component)**
- Full-screen modal with header (filename, page counter, download button, close).
- PDFs: rendered page-by-page using a PDF.js canvas viewer with:
  - Prev / Next page buttons + keyboard arrows
  - Zoom in/out + fit-to-width
  - Page number jump input
- Images (jpg/png/webp): shown directly with zoom controls.
- DOC/DOCX/PPT/XLS: browser cannot render these natively, so the viewer shows a clean "Preview not available — Download to view" panel with the download button (this is the standard, honest behavior).
- Smooth fade-in, themed in the existing terracotta/cream palette.

## Technical plan

**Backend (Lovable Cloud)**
1. Create a `vendor-files` storage bucket (public read for simple signed-free access; upload restricted via RLS by being open like the rest of this project, which currently uses open policies on `vendors`).
2. Create a `vendor_attachments` table:
   - `id uuid pk`
   - `vendor_id uuid` (references `vendors.id` on delete cascade)
   - `file_path text` (path inside bucket)
   - `file_name text`
   - `mime_type text`
   - `size_bytes bigint`
   - `created_at timestamptz default now()`
3. Open RLS policies (matching existing project convention) for select/insert/delete; storage policies allow public read + open insert/delete on the `vendor-files` bucket.

**API layer (`src/lib/vendor-files-api.ts`)**
- `uploadVendorFile(vendorId, file)` → uploads to `vendor-files/{vendorId}/{uuid}-{filename}` via `supabase.storage`, then inserts row.
- `listVendorFiles(vendorId)` → returns rows.
- `deleteVendorFile(attachment)` → removes storage object + row.
- `getPublicUrl(file_path)` → returns CDN URL.

**Form changes (`VendorForm.tsx`)**
- Add `pendingFiles: File[]` and `existingAttachments` state.
- After the vendor is created/updated successfully, upload each pending file and insert attachment rows. (Two-phase save so we have a `vendor_id` for new vendors.)
- Show inline progress per file; surface errors without blocking the rest.

**Detail view (`VendorDetail.tsx`)**
- Fetch attachments via React Query keyed by vendor id.
- Render a "Documents" section; each item is a button that opens the viewer.

**New `DocumentViewer.tsx`**
- Props: `file: { url, name, mime_type }`, `onClose`.
- Uses `pdfjs-dist` (worker via `?url` import) to render PDFs.
- Image branch uses `<img>` with zoom transform.
- Fallback branch for office docs with download CTA.
- Keyboard: Esc closes, ←/→ paginates, +/- zoom.

**Dependencies to add**
- `pdfjs-dist` (PDF rendering)
- `react-pdf` is intentionally avoided — using `pdfjs-dist` directly keeps bundle smaller and avoids version mismatch issues.

## Files touched

- `supabase/migrations/*.sql` (new) — bucket, table, policies
- `src/lib/vendor-files-api.ts` (new)
- `src/components/vendor/VendorForm.tsx` — attachments UI + upload on save
- `src/components/vendor/VendorDetail.tsx` — Documents section
- `src/components/vendor/DocumentViewer.tsx` (new)
- `src/components/vendor/VendorCard.tsx` — small paperclip badge if attachments exist (optional polish)
- `package.json` — add `pdfjs-dist`

## Notes / trade-offs

- **DOCX/PPTX/XLSX cannot be reliably rendered in-browser** without heavy libraries (mammoth, sheetjs, etc.) and they still produce imperfect output. The viewer will offer a Download button for these and render perfectly for PDFs and images. If you'd prefer in-browser DOCX rendering too, say the word and I'll add `mammoth` for DOCX → HTML conversion.
- Bucket will be **public-read** so the viewer can stream PDFs directly. If you want private files with signed URLs instead, I'll switch to a server function that mints short-lived URLs.
