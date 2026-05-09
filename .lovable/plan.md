# Admin project page — richer vendor cards + Add quote button

## Problem
On `/admin/projects/$id` the assigned-vendor cards only show category, vendor name, price, and a status pill. Details like Instagram, Google rating, location, contact, and website (which already come back from `getProject` because it `select("*")`s the vendors row) aren't rendered. The quotes pill doubles as both "Add quote" (when empty) and a summary chip (when not empty), so once a quote exists there's no obvious "Add quote" affordance.

## Changes — all in `src/routes/admin.projects.$id.tsx` (list view of `AssignedVendorsSection`)

### 1. Render vendor details on each card
Under the vendor name, add a compact details block showing whichever of these fields are present on the vendor row:
- Google rating (star icon + value, e.g. `★ 4.6`)
- Location
- Instagram handle (link to `https://instagram.com/<handle>` opens new tab)
- Contact number (tel: link)
- Website (external link)

Layout: small wrap-row of muted text with icons (`Star`, `MapPin`, `Instagram`, `Phone`, `Globe` from lucide-react), each item only rendered when its field is non-null. Price stays where it is.

### 2. Always-visible "Add quote" button
Split today's combined `VendorQuotesPill`:
- Keep the existing pill purely as a **summary chip** when there are quotes (e.g. `1st Quote · ₹X` / closed state with check). When there are no quotes, hide it.
- Add a separate **`+ Add quote`** button (terracotta outline, `Plus` + `FileText` icon) on every card that opens `ProjectVendorQuotesPanel` with `autoOpenForm: true` so the new-quote form is pre-opened. This button is shown regardless of whether quotes already exist.

The comments button stays as-is.

### Out of scope
- Grouped view, client side, vendor management page — not touched.
- No backend / data changes (fields already returned by `getProject`).
- No type changes.

## Technical notes
- All new icons come from `lucide-react` (already imported in the file — just extend the import).
- Reuse existing tokens (`var(--charcoal)`, `var(--terracotta)`, `var(--cream)`, `var(--border)`).
- The new "Add quote" button calls the same `setQuotesFor({ id, name, category, autoOpenForm: true })` flow already wired up.
