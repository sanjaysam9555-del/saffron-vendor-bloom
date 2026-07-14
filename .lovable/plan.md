# Saffron — Project Overview Document

I'll create a single markdown file at `src/documents/saffron-project-overview.md` (companion to the existing `saffron-design-system.md`) that another Lovable project can read to understand how this app is structured. It will be written in plain product/architecture language — no code dumps — so a different project's AI can reason about behavior, roles, data flow, and business rules.

## What the document will cover

### 1. What the app is
Saffron is an internal wedding-planning ops tool used by an events studio to manage vendors across many client weddings. Three sides use it:
- **Admin** (studio owner) — full control.
- **Employee** (studio staff) — day-to-day vendor management.
- **Client** (bride/groom) — read + react to their own project's shortlist.

All staff auth is gated to `@saffronevents.in`; clients are invited per project and only ever see their own project.

### 2. The main "legs" of the product
- **Vendor library** — the master catalogue of vendors (name, category, subcategory, city, Instagram, website, portfolio, price notes, Google rating, attachments). Shared across all projects.
- **Projects** — one per wedding: bride/groom names, wedding date, notes, assigned clients.
- **Project ↔ Vendor board** — for each project, staff curate a shortlist of vendors by category. Each row carries a per-project client_status (like / shortlisted / thinking / finalised / rejected) and can be flagged as a "Saffron Pick".
- **Quotes** — multiple quote rows per (project, vendor): amount, status (received / revised / closed / withdrawn), is_final, closed_amount, notes, and attached quote files. Only "closed" quotes count toward booked totals.
- **Category deadlines & criticality** — per project, each category has a due date, criticality (low/medium/high), planned budget and (optional) actual override. Drives the urgency strip and timeline.
- **Other expenses** — per-project ad-hoc line items outside the vendor flow (planned vs actual, booked flag, due date, criticality).
- **Client experience** — a curated summary + board view (kanban by status) + table view of their vendors, with per-vendor comments back to staff, and an Instagram preview for each vendor card.
- **Notifications** — bell for staff (new client comments, status changes, quote actions) and for clients (staff replies, new vendors added), plus transactional email.
- **Vendor self-signup** — public form for vendors to submit themselves; staff review submissions and promote them into the library.

### 3. Roles & access model
- Roles live in a separate `user_roles` table (admin / employee / client) checked via a `has_role` security-definer function — never on the profile.
- Staff (admin+employee) see everything; only admin can delete.
- Clients are linked to projects through `project_clients` and can only read data for their project. Server functions strip staff-only fields (internal notes, `created_by`) before returning to clients.
- All app-internal server logic runs as TanStack `createServerFn` with `requireSupabaseAuth` middleware. Public endpoints (vendor signup, Instagram asset proxy, email unsubscribe) live under `/api/public/*`.

### 4. Key business rules
- A vendor is "booked" for a project when it has at least one quote with status `closed`; `closed_amount` becomes the actual spend.
- "Actual" project spend = sum of closed vendor quotes + `actual_amount` on other-expenses rows.
- Entering an actual amount on an "other expense" auto-marks it booked.
- Category planned budget can be overridden per project; otherwise it rolls up from vendor planned amounts.
- Saffron Picks are a highlight, not a status — they tint the row/card in a light terracotta shade.
- Client statuses are ordered: like → thinking → shortlisted → finalised, with rejected as a terminal side state.
- Criticality drives the urgency strip color (high = red, medium = amber, low = blue), combined with days-to-due-date.

### 5. Data shape (high level)
Tables (public schema, RLS on, granted to `authenticated` + `service_role`):
- `vendors`, `vendor_categories`, `vendor_attachments`
- `projects`, `project_clients`
- `project_vendors` (join with client_status, saffron_pick, notes)
- `project_vendor_quotes`, `quote_files`
- `project_category_deadlines`, `project_other_expenses`
- `vendor_comments`, `notifications`, `client_notifications`
- `user_roles`, `profiles`
- `vendor_signup_submissions`
- `email_queue`, `email_suppressions`

### 6. Tech + integration notes (short)
- TanStack Start v1 on Cloudflare Workers, Vite 7, React 19, Tailwind v4, shadcn/ui.
- Data via Supabase (Lovable Cloud) — publishable key on client, service role only inside `*.server.ts` helpers loaded from server-fn handlers.
- Realtime: a single channel per page subscribes to relevant tables and invalidates React Query caches (debounced).
- Reads use `useSuspenseQuery` + loader-hydrated `queryClient.ensureQueryData`.
- Instagram previews are scraped once via Apify, mirrored into a private `instagram-cache` bucket, and served through a public asset proxy — never re-scraped on filter changes.
- Emails: templated React Email components enqueued to `email_queue`, drained by a cron endpoint under `/api/public/`.

### 7. What another project should copy vs adapt
- **Copy**: role separation via `user_roles` + `has_role`, per-project access via a join table, staff-vs-client field stripping in server functions, realtime-invalidate hook, quote-closing model, criticality/urgency scale.
- **Adapt**: category vocabulary, "Saffron Pick" concept, wedding-specific fields (bride/groom/date), INR-only formatting.

## Deliverable
One new file: `src/documents/saffron-project-overview.md`. No code changes, no other files touched.
