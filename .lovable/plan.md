# Project-Scoped Vendor Detail + Instagram Previews

Under "Assigned Vendors" on a specific project (`/admin/projects/$id`), the three views (Thumbnail, Group, Table) need two improvements.

## 1. Thumbnail view — show Instagram preview

Each thumbnail card already shows name, category, status, quotes, comments, etc. Add the vendor's Instagram preview image (square thumbnail with overlay handle) at the top of the card, matching the look the client-side card uses. If the vendor has no Instagram handle or no cached preview yet, fall back gracefully (skeleton → handle-only chip → nothing) — no broken images.

Data source: reuse `useInstagramPreviewsBulk(vendorIds)` (already used by client cards and the admin preview route). Compute the id list once from the visible vendor array and pass each card the resolved preview.

## 2. Table & Group views — clickable vendor name opens a project-scoped detail

Today the vendor name in the Table and Group views is plain text. Make it a button. Clicking it opens a NEW modal — `AdminProjectVendorDetail` — distinct from:
- `VendorDetail` (admin global vendor library), and
- `ClientVendorDetail` (client-facing read view).

This admin/project detail shows everything an admin needs about that vendor *in the context of this project*:

- Header: vendor name, category/subcategory, Saffron's Pick toggle, Booked badge, "Remove from project" action.
- **Instagram preview block** (uses `VendorInstagramDetailBlock`, same as global vendor detail).
- Core vendor facts: location, phone, email, Instagram, website, portfolio, price, commission, rating(s).
- **Project-specific quotes** — full quote history scoped to this project (reuses `ProjectVendorQuotesPanel` logic / `listProjectVendorQuotes`), with the existing "Add quote" action.
- **Client status per client** on this project (the per-client rows already computed as `selections[v.id]`, rendered with `ClientStatusPill` + names).
- **Client comments** thread for this project+vendor (reuses `VendorCommentsThread`).
- Attachments grid (reuses `AttachmentThumbnailGrid` + signed viewer), since these are vendor-level docs admins want here too.
- Prev/Next arrows + `X / Y` counter + ← → keyboard nav across the currently filtered/sorted vendor list, matching the pattern just added to the other detail modals.
- The same modal opens from the Thumbnail card too (clicking the card body), so all three views share the entry point.

Triggering the modal does NOT replace the existing inline buttons (Add quote, comments, Saffron's Pick, Remove) on the thumbnail or table rows — those keep working as quick actions. Only the vendor name becomes clickable.

## Files

- New: `src/components/admin/AdminProjectVendorDetail.tsx` — the new modal.
- Edit: `src/routes/admin.projects.$id.index.tsx`
  - Thumbnail card: add Instagram preview at top, make name a button that opens the new modal.
  - Group view: wrap vendor name in a button that opens the modal.
  - Table view: wrap vendor cell in a button that opens the modal.
  - Add `detail` state (selected vendor id) + render the modal once at page level, lazy-loaded.
  - Compute `useInstagramPreviewsBulk` once for the visible vendor list and pass into card + modal.

## Out of Scope

- No changes to the global Vendors tab detail (`VendorDetail.tsx`).
- No changes to the client-facing detail (`ClientVendorDetail.tsx`).
- No backend / RLS / schema changes; all data already exposed via existing server functions.
- No edits in the Table/Group rows beyond making the name clickable.
