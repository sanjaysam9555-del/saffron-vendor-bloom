## Goal

Show **every** quote received for a vendor (not just the latest/closed one) in:
1. The client portal — vendor card + vendor detail panel.
2. The admin project page — the per-vendor row in `/admin/projects/$id`.

So clients and staff can compare all quotes side by side without opening a separate panel.

## Current behavior

- **Client detail panel** (`src/components/client/ClientVendorDetail.tsx`): `getLatestProjectVendorQuote` → renders one quote.
- **Client card** (`src/components/client/ClientVendorCard.tsx`): renders one summary chip from `vendor.quote_summary`.
- **Admin project page vendor row** (`src/routes/admin.projects.$id.tsx`, `VendorQuotesPill`): already loads the full quote list via `listProjectVendorQuotes`, but renders a single collapsed pill (closed or "N quotes"). Detail still requires opening `ProjectVendorQuotesPanel`.
- The full quote list already exists server-side (`listProjectVendorQuotes` in `src/lib/quote-api.ts`); the detail panels keep updating live via existing realtime subscriptions on `project_vendor_quotes` / `project_vendor_quote_files`.

## Plan

### 1. Client detail panel — render every quote
In `ClientVendorDetail.tsx`:
- Replace the `useQuery` that calls `getLatestProjectVendorQuote` with one that calls `listProjectVendorQuotes` (returns `ProjectVendorQuote[]`, newest-first, with `files`).
- Replace the single quote block with a list, in this order:
  1. Closed/final quote first (green "Closed quote" header, large amount).
  2. All other quotes newest-first, header `Quote · <formatted date>`, amount, text, files.
- Reuse the existing layout primitives (amount, `quote_text` block, file row with `SignedQuoteFileViewer`). The `viewingQuoteFile` state and modal are shared across all quotes.
- Empty state: render nothing (same as today).

### 2. Client vendor card — show every quote as a chip
a. **Server payload** in `src/server/projects.functions.ts` `getMyProject`:
   - Keep `quote_summary` (still used for color/icon decisions).
   - Add a sibling `quotes: { id; status; is_final; quote_amount; closed_amount; created_at }[]` per vendor, newest-first, derived from the `qrows` query already being run — no extra round-trip.

b. **Types** in `src/lib/project-types.ts`:
   - Add `quotes?: { id; status; is_final; quote_amount; closed_amount; created_at }[]` on `ClientVendor`.

c. **Render** in `ClientVendorCard.tsx`:
   - Replace the single summary chip with a small wrap-flow row of chips, one per quote.
   - Closed/final chip: green pill with `CircleCheck` and the closed amount (fallback to quote amount).
   - Other chips: terracotta pill with the amount (fallback to "Quote").
   - Keep existing `attachments` and `comment_count` indicators alongside, unchanged.

### 3. Admin project page vendor row — show every quote inline
In `src/routes/admin.projects.$id.tsx` `VendorQuotesPill`:
- Keep the same `useQuery(listProjectVendorQuotes)` data; remove the single-pill rendering.
- Replace with a wrap-flow row of compact chips (one per quote), styled to match the existing pill (border, rounded-full, terracotta hover):
  - Closed/final chip first: green pill with `CircleCheck` and the closed amount.
  - Other chips newest-first: neutral pill with amount (fallback to short "Quote").
- Each chip is a button that opens `ProjectVendorQuotesPanel` for that vendor (same `onOpen(false)` callback). Optionally pass the quote id for future deep-link, but no behavior change required.
- Keep the existing `Paperclip` + total file count indicator at the end of the row.
- Keep the "+ Add quote" button next to the row, unchanged.
- Empty state still renders nothing (the "+ Add quote" button stays separate, as today).

### 4. Verify
- Client: vendor with multiple quotes → card shows one chip per quote (closed first), detail panel shows every quote with amount/text/files.
- Admin `/admin/projects/$id`: vendor row shows one chip per quote inline; clicking any chip opens the existing quotes panel; "+ Add quote" still works.
- Add/edit/close a quote from the admin side → both client UI and admin row update live (existing realtime invalidation already covers this).
- Vendors with zero quotes show no chips on either side — same as today.

## Out of scope
- No changes to `ProjectVendorQuotesPanel` itself, the admin projects index, the vendor detail (admin) page, the quote summary helper, or the database schema.
- No changes to sorting, filtering, comments, status select, or file viewer.