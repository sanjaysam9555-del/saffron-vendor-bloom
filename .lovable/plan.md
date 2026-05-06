# Per-Client Vendor Quotes & Booked History

## Today vs. what's missing

Today the vendor record has one generic `price_text` and `quote_breakdown` (knowledge/onboarding info). There's no concept of a quote a vendor sent for a *specific client/project*, no place to attach a quote PDF for that client, no final "closed amount", and no signal on a vendor card that they were booked before.

## What we'll add

### 1. New table: `project_vendor_quotes`
One row per quote a vendor sends for a project. A vendor can have many quotes per project (revisions). Fields:

- `id`, `project_id`, `vendor_id`, `category` (snapshot)
- `quote_text` (nullable) — paste-in text quote
- `quote_amount` (numeric, nullable) — parsed/typed numeric value if known
- `currency` (default `INR`)
- `status` enum: `received` | `revised` | `closed` | `withdrawn`
- `is_final` (bool) — set true on the one quote that represents the closed deal
- `closed_amount` (numeric, nullable) — only set when status = `closed`
- `notes` (nullable)
- `created_by`, `created_at`, `updated_at`

### 2. New table: `project_vendor_quote_files` (Quote File attachments)
Each quote can have **zero or more attached files** — typically the PDF the vendor emailed, but also images of handwritten quotes, screenshots, Word docs, etc. Fields:

- `id`, `quote_id` (FK → project_vendor_quotes, ON DELETE CASCADE)
- `file_path` (storage path), `file_name`, `mime_type`, `size_bytes`
- `uploaded_by`, `created_at`

Files are stored in the existing `vendor-files` Supabase Storage bucket under a clear prefix:
`quotes/{project_id}/{quote_id}/{uuid}-{safe_name}`

This reuses the same auth-checked signed-URL flow we already have for vendor attachments (`getVendorFileSignedUrl`) — we'll add a parallel `getQuoteFileSignedUrl` that authorises against `project_vendor_quotes.project_id` (staff always allowed; clients allowed only if they belong to that project).

Accepted types & limits mirror existing vendor uploads:
- `.pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png, .webp` — max 20 MB per file.

### 3. Admin UI for adding quote files

**Add Quote dialog** (opened from the project page → vendor row → "Add quote"):
- Amount (numeric, optional)
- Quote text (textarea, optional)
- **Attach files**: drag-and-drop zone + "Choose files" button, multi-select. Shows each pending file with name, size, and a remove (×) button before submit.
- Notes (optional)
- Save → creates the quote row, then uploads each file to storage and inserts a `project_vendor_quote_files` row per file (best-effort cleanup on failure, same pattern as `uploadVendorAttachment`).

**Edit Quote dialog** (existing quote):
- Same fields, plus:
- Existing files listed with preview/download (signed URL via `SignedDocumentViewer`) and a delete button per file.
- "Add more files" button to append new attachments to the same quote.

**Mark as Closed action**:
- Opens a small confirm with a "Closed amount" input (defaults to the quote's `quote_amount`). Sets `status='closed'`, `is_final=true`, `closed_amount`, and clears `is_final` on sibling quotes via a trigger.

### 4. Booked-vendor signal (the "previously engaged" highlight)
A SQL view `vendor_booked_summary` aggregates per `vendor_id`:
- `times_booked` (count of distinct projects with a `closed` quote)
- `last_booked_at`, `last_closed_amount`, `last_project_id`

Used to show a "Booked ×N" badge on `VendorCard` and a "Previously booked" section on `VendorDetail`.

### 5. Admin views

**On the project page (`/admin/projects/$id`)** — each assigned vendor row gets:
- A "Quotes (n)" pill. Click to open the Quotes drawer for that vendor on this project.
- If a quote is closed, show "Closed ₹4,50,000" inline with a paperclip icon if files are attached.

**Quotes drawer** (`ProjectVendorQuotesPanel`):
- List of quotes newest-first. Each row shows amount, status, file thumbnails/names, created date, and actions: edit, mark as closed, withdraw, delete.
- Files inside each row preview via `SignedDocumentViewer` (PDF/image inline, others download).
- "Add quote" button at top opens the Add Quote dialog described above.

**On the vendor detail (`VendorDetail`)** — new "Quote history" section, collapsed by default:
- Every quote this vendor has ever submitted across projects, grouped by project (bride & groom + date).
- Shows amount, status badge, file count with paperclip, and a link to that project. Files openable inline.

**On the vendor card / table**:
- If `times_booked > 0`, show a "Booked ×N" chip in champagne, tooltip "Last booked for {bride} & {groom} on {date}".
- Vendor list filter toggle: "Previously booked".

### 6. Client side (read-only)
On `ClientVendorDetail`, if a quote exists for this client's project + vendor:
- Closed quote → show "Your quote: ₹…" as the headline price and list its attached files (clients can download the PDF the vendor sent).
- Otherwise → show "Latest quote: …" with files attached.

RLS for `project_vendor_quote_files`: clients on a project can SELECT files belonging to quotes for their project; only staff can INSERT/UPDATE/DELETE.

## Where things live

```text
supabase migration  →  project_vendor_quotes, project_vendor_quote_files,
                       quote_status enum, vendor_booked_summary view,
                       trigger to enforce single is_final per (project,vendor),
                       RLS policies
src/server/quotes.functions.ts              (list/create/update/close/delete)
src/server/quote-files.functions.ts         (upload metadata, signed URLs,
                                             auth check vs project membership)
src/lib/quote-types.ts                      (TS types)
src/lib/quote-api.ts                        (client wrappers, file upload helper)
src/hooks/useProjectVendorQuotes.ts         (react-query hooks)
src/components/admin/ProjectVendorQuotesPanel.tsx   (drawer)
src/components/admin/QuoteFormDialog.tsx            (add/edit quote + files)
src/components/admin/QuoteFileList.tsx              (existing files w/ delete)
src/components/admin/VendorQuoteHistory.tsx         (vendor detail section)
src/components/vendor/BookedBadge.tsx               (chip on cards/detail)
edits: src/routes/admin.projects.$id.tsx,
       src/components/vendor/VendorDetail.tsx,
       src/components/vendor/VendorCard.tsx,
       src/components/client/ClientVendorDetail.tsx
```

## Data integrity rules
- Trigger ensures at most one `is_final = true` per `(project_id, vendor_id)`.
- Marking a quote `closed` automatically sets `is_final = true` and clears it on siblings.
- Deleting a quote cascades to `project_vendor_quote_files` rows; the server function also removes the underlying storage objects (best-effort, mirrors `deleteVendorAttachment`).
- `vendor_booked_summary` is a view, so the "Booked ×N" badge stays accurate without a sync job.

## Out of scope
- OCR / auto-parsing amounts out of PDF quotes.
- Email-in quotes (forwarding a vendor email straight into the system).
- Commission / payout tracking from the closed amount.
