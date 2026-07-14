# Saffron — Project Overview

A portable brief describing how the Saffron wedding-planning ops platform is
organized. Written for another project's AI/PM to understand behavior, roles,
data flow, and business rules — not an implementation guide.

Companion document: `saffron-design-system.md` (visual language).

---

## 1. What the app is

Saffron is an internal wedding-planning operations tool used by an events
studio to manage vendors across many client weddings simultaneously.

Three sides use it:

- **Admin** (studio owner) — full control, including deletes and user
  management.
- **Employee** (studio staff) — day-to-day vendor and project management.
- **Client** (bride / groom / family) — read-only access to their own
  wedding, plus reactions and comments.

Staff accounts are gated to the `@saffronevents.in` email domain. Clients
are invited per project and never see any other project's data.

---

## 2. The main "legs" of the product

### Vendor library (global)
The master catalogue of vendors, shared across all projects. Each vendor
has: name, category, subcategory, city / location, Instagram handle,
website, portfolio link, price notes, Google rating, and attachments
(images, brochures, PDFs). Categories are managed as a first-class list.

### Projects
One record per wedding: bride name, groom name, wedding date, notes, and
one or more assigned client users. Everything downstream is scoped to a
project.

### Project ↔ Vendor board
For each project, staff curate a shortlist of vendors by category. The
join carries per-project state:

- `client_status`: `like`, `thinking`, `shortlisted`, `finalised`,
  `rejected` (or none).
- `saffron_pick`: a highlight flag ("we recommend this one"). Not a
  status — renders as a light terracotta row tint.
- Internal notes (staff-only).

### Quotes
Multiple quote rows per `(project, vendor)`:

- `quote_amount`, `currency` (INR default), `notes`.
- `status`: `received`, `revised`, `closed`, `withdrawn`.
- `is_final` flag and `closed_amount` (what was actually booked at).
- Attached quote files (PDFs, images) stored per quote.

Only quotes with status `closed` count toward "booked" totals.

### Category deadlines & criticality
Per project, each category can have:

- `due_date` (when this category needs to be locked in).
- `criticality`: `low`, `medium`, `high`.
- `planned_amount` (category budget) and optional `actual_amount_override`.
- Staff-only notes.

Drives the urgency strip and timeline views.

### Other expenses
Per-project ad-hoc line items outside the vendor flow (venue deposits,
gifting, travel, etc.). Fields: label, planned vs actual amount, notes,
sort order, criticality, booked flag, due date. Entering an actual amount
auto-marks the row booked.

### Client experience
Clients get their own surface:

- **Summary** — top-level stats (booked count, spend vs budget, upcoming
  deadlines).
- **Board** — kanban grouped by `client_status`, drag to change status.
- **Table** — sortable list with the same data.
- **Vendor detail** — gallery, Instagram preview, comments thread back
  to staff.

### Notifications
Two bells:

- Staff bell: new client comments, client status changes, quote actions.
- Client bell: staff replies, new vendors added to their board, status
  changes made on their behalf.

Also transactional email (React Email templates) for the same events, with
per-user suppression and unsubscribe.

### Vendor self-signup
Public form at `/vendor-signup` where vendors submit themselves.
Submissions land in a review queue; staff promote approved ones into the
main vendor library.

---

## 3. Roles & access model

- Roles live in a **separate `user_roles` table** (`admin` / `employee` /
  `client`), never on the profile — checked via a `has_role` security-
  definer Postgres function to avoid RLS recursion.
- Staff (admin + employee) see everything across projects. **Only admin
  can delete.**
- Clients are linked to projects via a `project_clients` join and can only
  read data for their own project.
- All app-internal server logic runs as TanStack `createServerFn` guarded
  by a `requireSupabaseAuth` middleware. Handlers explicitly re-check
  role and project access.
- Server functions **strip staff-only fields** (internal notes,
  `created_by`, etc.) from responses before returning to clients.
- Public endpoints (vendor signup, Instagram asset proxy, email
  unsubscribe, cron drains) live under `/api/public/*` and verify their
  own callers.

---

## 4. Key business rules

- A vendor is **booked** for a project when it has ≥1 quote with status
  `closed`. `closed_amount` is the actual spend.
- **Project actual spend** = sum of closed vendor quotes + `actual_amount`
  on other-expenses rows.
- **Project planned spend** = sum of category planned budgets (per-project
  override wins over rollup from vendor planned amounts) + planned amounts
  on other-expenses rows.
- Entering an `actual_amount` on an "other expense" auto-sets `booked =
  true` (no separate quote flow for these).
- **Saffron Pick** is a visual highlight, not a status — it tints the
  row / card in a light terracotta shade and never changes filtering.
- `client_status` progression: `like` → `thinking` → `shortlisted` →
  `finalised`. `rejected` is a terminal side state.
- **Criticality** drives the urgency strip color, combined with days-to-
  due-date: high → red, medium → amber, low → blue, none → neutral. Past
  due always escalates.
- Currency is INR only; formatted in Indian short form (₹1.2L, ₹3Cr).

---

## 5. Data shape (high level)

Tables in the `public` schema. All have RLS enabled and explicit grants
to `authenticated` + `service_role` (anon only where truly public).

**Identity & auth**
- `profiles` — display name / email mirror.
- `user_roles` — `(user_id, role)` unique; the source of truth for roles.

**Vendor library**
- `vendors`
- `vendor_categories`
- `vendor_attachments`
- `vendor_signup_submissions` — public-form intake queue.

**Projects & scoping**
- `projects`
- `project_clients` — grants a client user access to a project.

**Per-project vendor state**
- `project_vendors` — join row with `client_status`, `saffron_pick`,
  staff notes.
- `project_vendor_quotes` — one row per quote iteration.
- `quote_files` — attachments per quote.

**Budget & schedule**
- `project_category_deadlines` — per-category due date, criticality,
  planned/actual override.
- `project_other_expenses` — ad-hoc line items.

**Comms**
- `vendor_comments` — threaded per (project, vendor).
- `notifications` — staff inbox.
- `client_notifications` — client inbox.
- `email_queue`, `email_suppressions` — transactional email plumbing.

**Storage buckets**
- `vendor-attachments` (private, staff/client-scoped signed reads)
- `quote-files` (private)
- `instagram-cache` (private, served via public asset proxy)

---

## 6. Tech & integration notes

- **Frontend**: TanStack Start v1 (file-based routing under `src/routes/`),
  React 19, Vite 7, Tailwind v4, shadcn/ui.
- **Runtime**: Cloudflare Workers (edge). No Node-only packages.
- **Backend**: Supabase (Lovable Cloud). Publishable key on the client;
  service role only inside `*.server.ts` helpers dynamically imported
  from server-function handlers.
- **Reads**: `queryClient.ensureQueryData` in loaders +
  `useSuspenseQuery` in components. No `useEffect + fetch` for initial
  render.
- **Realtime**: one Supabase channel per page subscribes to the relevant
  tables and invalidates matching React Query caches (debounced ~250ms)
  via a shared `useRealtimeInvalidate` hook.
- **Instagram previews**: scraped once via Apify, mirrored into the
  private `instagram-cache` bucket, and served through
  `/api/public/ig-asset`. Filter toggles hydrate from existing query
  caches — **never re-scrape**.
- **Emails**: React Email templates enqueued to `email_queue`; drained by
  a cron endpoint under `/api/public/`. Suppression list honored on
  every send.
- **PWA**: installable, cream `theme-color`, safe-area padding on the
  sticky header so the iOS status bar merges into the app chrome.

---

## 7. What another project should copy vs adapt

**Copy the pattern**
- Role separation via `user_roles` + `has_role` (never store roles on
  profile / users).
- Per-project access via a dedicated join table + server-side re-check
  in every function.
- Staff-vs-client field stripping in server functions (don't rely on RLS
  column filtering alone).
- Realtime-invalidate hook (one channel, many tables, debounced React
  Query invalidation).
- Quote-closing model (multiple iterations, only `closed` counts as
  booked, closed amount is source of truth).
- Criticality × due-date urgency scale.
- Enqueue-then-drain email pattern with suppression.

**Adapt to your domain**
- Category vocabulary and subcategories.
- "Saffron Pick" concept (rename to your own recommendation flag).
- Wedding-specific fields (bride / groom / wedding_date) — replace with
  your primary entity.
- INR-only currency and Indian short-form formatting.
- Domain-restricted staff signup (`@saffronevents.in`).
