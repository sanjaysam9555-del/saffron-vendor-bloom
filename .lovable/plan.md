# Plan: Deep-dive addendum to `saffron-project-overview.md`

Add a new "Part B — Deep Dive" to the existing overview file (kept as one downloadable `.md`), covering every field on the main entities and every UI/flow question you asked. High-level Part A stays as the summary; Part B is the reference other-project AI reads to actually build parity.

## Sections to add

### 1. Full field reference (each table, column-by-column)
For each of these, list: column name → type, nullability, default, meaning, who can write it, whether it's stripped for clients.

- `vendors` (all 25 columns: name, category, subcategory, location, contact_number, email, instagram_handle, website, google_rating, saffron_rating, price_text, commission_model, portfolio_link, source, remarks, number_of_rooms, distance_from_delhi, hotel_category, quote_breakdown, team_size, deliverables, submitted_via_form, date_added, updated_at + derived flags `has_assignment` / `has_quote_history` / `has_attachment`).
- `categories`
- `vendor_attachments`
- `vendors_signup_submissions`
- `projects`
- `project_clients`
- `project_vendors` (the assignment join: `client_status`, `saffron_pick`, staff notes, timestamps)
- `client_vendor_status` (per-client reactions vs the shared board status — call out the distinction explicitly)
- `project_vendor_quotes` (all 14 cols: quote_amount, currency, status, is_final, closed_amount, quote_text, category snapshot, notes, created_by, timestamps)
- `project_vendor_quote_files`
- `project_vendor_comments`
- `project_category_deadlines`
- `project_other_expenses`
- `vendor_instagram_previews`
- `staff_notifications` / `client_notifications`
- `user_roles` / `profiles`

### 2. Vendor card anatomy (staff side)
- Sources of truth for each visible element (name, category chip, location, price text, IG handle, rating, Saffron Pick tint, booked badge, quote count, attachment thumbnails).
- Exactly which query populates the card grid (`useVendors` → `listVendorsServer`) and how derived flags (`has_assignment`, `has_quote_history`, `has_attachment`) are computed server-side.
- Hover/interaction affordances: click → detail drawer, right-click / kebab → edit / delete (admin only) / assign-to-project.
- Bulk selection bar, bulk-edit dialog, bulk Instagram sync.
- Instagram preview: cache-first render, never re-scrape on filter toggles.

### 3. Vendor card anatomy (client side)
- `ClientVendorCard`: gallery hero, category, price text, `client_status` pill, comment count, Saffron Pick tint.
- Board vs Table vs Detail: same underlying `ClientVendor` shape, different presentations.
- Field stripping applied server-side (no `remarks`, `commission_model`, `source`, `created_by`, staff-only quote fields).

### 4. Assignment flow (vendor → project)
Step-by-step:
1. Staff opens a project, hits "Add vendor" → `QuickAddVendorPanel` / `VendorProjectAssigner`.
2. Search across `vendors` library, multi-select, submit → server fn upserts `project_vendors` row(s).
3. On assignment, default `client_status = null`, `saffron_pick = false`.
4. Realtime channel invalidates project's vendor list + client's board.
5. Removing an assignment: admin-only; cascades to quotes/comments? — document actual behavior.
6. A vendor can be assigned to many projects; per-project state is fully independent.

### 5. Quotes flow
- Data model: many `project_vendor_quotes` per `(project, vendor)`, ordered by `created_at`; `buildQuoteSeqMap` numbers them Q1/Q2/Q3 for display.
- Status lifecycle: `received` → optional `revised` iterations → `closed` (booked) OR `withdrawn` (dead).
- `is_final` uniqueness: `enforce_single_final_quote` trigger — closing a quote sets `is_final=true` and unsets it on siblings.
- `closed_amount` vs `quote_amount`: quoted price vs actually booked price; closed_amount is the number that rolls into project spend.
- File attachments per quote (`project_vendor_quote_files`), signed URLs on read.
- UI surfaces: `ProjectVendorQuotesPanel` (staff editor), `VendorQuoteHistory` (timeline), `SignedQuoteFileViewer` (secure preview).
- Client visibility: sees quote count + latest status + closed amount only, never `notes` or `created_by`.
- Rollups: "booked" badge on card, project summary spend numbers, category "actual vs planned" — all derived from closed quotes + other expenses.

### 6. Statuses & derived indicators cheat sheet
- `client_status` values with color tokens (pill classes already in `client-status.ts`).
- Quote statuses + which count toward booked.
- Criticality × due-date urgency matrix.
- Saffron Pick as a highlight (not a filterable status).

### 7. End-to-end user journeys
Short walkthroughs so another AI understands the "why":
- Staff adds a new vendor from scratch → assigns to project → logs quotes → closes deal.
- Vendor self-signup → review queue → promote to library.
- Client logs in → lands on Summary → moves a card on the Board → comments on a vendor → staff gets notification + email.

## Deliverable

- Update `src/documents/saffron-project-overview.md` in place (append Part B; keep Part A summary intact so the doc reads top-down).
- Mirror to `/mnt/documents/saffron-project-overview.md` so it stays downloadable.
- No code changes to the app itself.
