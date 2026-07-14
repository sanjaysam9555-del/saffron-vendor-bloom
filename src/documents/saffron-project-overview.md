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

---

# Part B — Deep Dive Reference

This section is the "read this to build parity" companion to Part A. Every
field, every card element, every flow, explicit.

---

## B1. Full field reference

Convention: `column :: type (nullability) [default]` — meaning / who writes / client-visibility.

### `vendors` (global vendor library)
- `id :: uuid NOT NULL [gen_random_uuid()]`
- `vendor_name :: text NOT NULL` — display name.
- `category :: text NOT NULL` — free text, but always chosen from `categories`.
- `subcategory :: text` — optional refinement (e.g. Photography → Candid).
- `location :: text` — city / area.
- `contact_number :: text` — staff-only; stripped for clients.
- `email :: text` — staff-only; stripped.
- `instagram_handle :: text` — with or without `@`; used to build IG preview.
- `website :: text`
- `google_rating :: numeric` — 0–5, one decimal.
- `saffron_rating :: numeric` — internal 0–5 score; staff-only.
- `price_text :: text` — free-form price note ("₹80k–₹1.2L per event"). Not used in totals.
- `commission_model :: text` — staff-only.
- `portfolio_link :: text` — Drive / website portfolio.
- `source :: text [Manual Entry]` — where the lead came from; staff-only.
- `remarks :: text` — internal notes; staff-only.
- `number_of_rooms :: integer` — hotels/venues only.
- `distance_from_delhi :: text` — venues only.
- `hotel_category :: text` — 3★/4★/5★/luxury.
- `quote_breakdown :: text` — pricing template snippet.
- `team_size :: text`
- `deliverables :: text`
- `submitted_via_form :: boolean NOT NULL [false]` — true if promoted from public signup.
- `date_added :: timestamptz NOT NULL [now()]`
- `updated_at :: timestamptz NOT NULL [now()]`

Derived (added by `listVendorsServer`, not columns):
- `has_assignment` — true if any `project_vendors` row exists.
- `has_quote_history` — true if any `project_vendor_quotes` row exists.
- `has_attachment` — true if any `vendor_attachments` row exists.

### `categories`
- `id`, `name NOT NULL`, `is_base bool` (seeded core category — cannot be renamed/deleted), `is_deleted bool` (soft delete), timestamps.

### `vendor_attachments`
- `id`, `vendor_id`, `file_path` (in `vendor-files` bucket), `file_name`, `mime_type`, `size_bytes`, `created_at`.
- Read via signed URLs. No `uploaded_by` column — attribution is not tracked.

### `projects`
- `id`, `bride_name NOT NULL`, `groom_name NOT NULL`, `wedding_date date NOT NULL`, `notes`, `created_by uuid`, `created_at`, `updated_at`, `archived_at timestamptz`.
- `archived_at` non-null hides the project from active lists but preserves data.

### `project_clients`
- `id`, `project_id`, `user_id`, `created_at`. Unique on `(project_id, user_id)`.
- Presence of a row = that user can read that project. Grant is checked via `has_project_access(user_id, project_id)`.

### `project_vendors` (the assignment join)
- `id`, `project_id`, `vendor_id`, `created_at`, `is_saffron_pick bool NOT NULL [false]`.
- Unique on `(project_id, vendor_id)`.
- **Note:** the shared "board status" (`client_status`) is NOT stored here. It lives in `client_vendor_status`, keyed by the client user, so each client's board is personal to that client even inside the same project.

### `client_vendor_status`
- `id`, `user_id`, `vendor_id`, `status :: client_vendor_status enum NOT NULL`, timestamps.
- Enum values: `like`, `shortlisted`, `finalised`, `rejected`, `thinking`.
- Unique on `(user_id, vendor_id)`. Only the owning client (and staff on their behalf) can write.
- Absent row = "no reaction yet".

### `project_vendor_quotes`
- `id`, `project_id`, `vendor_id`, `category text` (snapshot of vendor's category at quote time),
  `quote_text text` (free-form quote description), `quote_amount numeric`,
  `currency text NOT NULL ['INR']`, `status quote_status NOT NULL ['received']`,
  `is_final bool NOT NULL [false]`, `closed_amount numeric`, `notes text` (staff-only),
  `created_by uuid`, `created_at`, `updated_at`.
- Enum `quote_status`: `received | revised | closed | withdrawn`.
- Trigger `enforce_single_final_quote`: setting `status='closed'` forces `is_final=true` and unsets `is_final` on all sibling quotes for the same `(project, vendor)`.
- Client-visible fields: `quote_amount`, `currency`, `status`, `closed_amount`, `created_at`, plus derived counts. Stripped: `notes`, `created_by`, `quote_text`.

### `project_vendor_quote_files`
- `id`, `quote_id`, `file_path` (in `vendor-files` bucket, subfolder per quote), `file_name`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`.
- Served via signed URLs through `/api/files/stream/*`.

### `project_vendor_comments`
- `id`, `project_id`, `vendor_id`, `user_id`, `body text NOT NULL`, `parent_id uuid` (for one-level threading), `created_at`.
- Author identity is resolved through `profiles` for display; clients see staff replies as "Saffron Team".

### `project_category_deadlines`
- `id`, `project_id`, `category text NOT NULL`, `due_date date`, `criticality text NOT NULL ['medium']` (`low|medium|high`), `notes` (staff-only), `planned_amount numeric`, `actual_amount_override numeric`, `created_by`, timestamps.
- One row per `(project, category)`. Drives the urgency strip and category budget totals.
- `actual_amount_override` wins over the rollup sum of closed quotes for that category.

### `project_other_expenses`
- `id`, `project_id`, `label text NOT NULL`, `planned_amount numeric`, `actual_amount numeric`, `notes text`, `sort_order int NOT NULL [0]`, `criticality text NOT NULL ['medium']`, `booked bool NOT NULL [true]`, `due_date date`, `created_by`, timestamps.
- Filling `actual_amount` is the convention for "actually spent"; `booked=true` is the default because these are typically confirmed line items (venue advance, gifting, etc.).

### `vendor_instagram_previews`
- Keyed by `vendor_id` (PK). `handle`, `avatar_url`, `display_name`, `bio`, `followers_text`, `post_thumbnails text[]`, `profile_url`, `status text NOT NULL ['ok']` (`ok|error|pending`), `last_error`, `fetched_at`, `updated_at`.
- Populated by the Apify scrape via `trigger-instagram-preview.server.ts`; all `post_thumbnails` URLs point at cached objects in the `instagram-cache` bucket and are served through `/api/public/ig-asset`.

### `staff_notifications`
- `id`, `kind`, `project_id`, `vendor_id`, `actor_user_id`, `title`, `body`, `metadata jsonb`, `read_by jsonb {}` (map of `user_id → read_at`), `created_at`.
- Shared across staff; per-user read state lives in the `read_by` JSON so any admin/employee can independently mark read.

### `client_notifications`
- `id`, `user_id` (recipient), `project_id`, `vendor_id`, `actor_user_id`, `kind`, `title`, `body`, `metadata`, `read_at`, `created_at`.
- One row per recipient (unlike staff which uses fan-in with `read_by` map).

### `user_roles`
- `id`, `user_id`, `role app_role NOT NULL` (`admin|employee|client`), `created_at`.
- Unique `(user_id, role)`. Enforced by `enforce_staff_email_domain` trigger: `admin`/`employee` rows require `@saffronevents.in` email.

### `profiles`
- `id`, `user_id UNIQUE`, `display_name`, timestamps. Auto-created by `handle_new_user` trigger on `auth.users` insert.

### `inbound_leads`
- Public "vendor sign-up" queue: `name`, `services`, `location`, `contact`, `instagram`, `email`, `portfolio`, `status text ['new']` (`new|approved|rejected|imported`), `submitted_at`.

---

## B2. Vendor card anatomy — staff side

Component: `src/components/vendor/VendorCard.tsx` (grid) + `VendorTable.tsx` (list mode).
Data source: `useVendors()` → `listVendorsServer()` returns all `vendors` plus the three derived booleans.

Visible elements, top → bottom:

1. **Selection checkbox** — appears on hover or when any card is already selected; feeds `BulkActionBar`.
2. **Instagram preview strip** — 4 square thumbnails from `vendor_instagram_previews.post_thumbnails`. Renders only if a cached row exists; if `status='pending'` shows shimmer, if `status='error'` shows a subtle broken-link chip. Filter toggles NEVER re-scrape — they only read from cache (see `use-instagram-previews.ts`).
3. **Vendor name** (`vendor_name`) + optional **Saffron Pick tint** — pale terracotta background when any assignment has `is_saffron_pick=true`.
4. **Category chip** (`category`), and subcategory as a lighter secondary chip.
5. **Location** (`location`) with a pin icon.
6. **Price text** (`price_text`) — free-form.
7. **Ratings row** — Google rating (star + number), Saffron rating (petal glyph + number).
8. **Signal icons** in the footer (all from the derived flags):
   - Paperclip = `has_attachment`
   - Briefcase = `has_assignment` (assigned to ≥1 project)
   - Receipt = `has_quote_history` (any quote logged, historical or current)
9. **Booked badge** — shown when the vendor has ≥1 `project_vendor_quotes` row with `status='closed'` in any project. Component: `BookedBadge`.
10. **Kebab menu** — Edit (staff), Delete (admin only), Assign to project, View detail.

Interactions:
- Click card → opens `VendorDetail` side drawer.
- Multi-select → `BulkActionBar` with Edit fields, Delete, Assign to project, Bulk IG sync.
- Drag-and-drop is NOT used for vendors; assignment is via dialog.

---

## B3. Vendor card anatomy — client side

Component: `src/components/client/ClientVendorCard.tsx`. Data shape: `ClientVendor` (see `src/lib/project-types.ts`) — server-stripped subset.

Visible elements:

1. **Attachment hero** — first image in `attachments[]`, or IG avatar fallback, or a category-color placeholder.
2. **Vendor name**, **category / subcategory chips**, **location**.
3. **Price text** (kept — clients see it).
4. **Client status pill** — one of `like|thinking|shortlisted|finalised|rejected` from `client_vendor_status.status` for the current user, with the palette defined in `src/lib/client-status.ts`. Absent = no pill.
5. **Saffron Pick tint** — same terracotta wash as staff, from `project_vendors.is_saffron_pick`.
6. **Comment count** — from `comment_count` (rollup of `project_vendor_comments`).
7. **Booked ribbon** — from `quote_summary.has_closed`; the closed amount is shown when present.
8. **Menu** — change status (writes `client_vendor_status`), open detail.

Detail view (`ClientVendorDetail`) adds: attachment gallery viewer, IG preview, quotes list (client-safe columns), comments thread. Board (`ClientBoardView`) and Table (`ClientVendorTable`) reuse the same `ClientVendor` list — the server call is one, the presentation is three.

Stripped server-side before returning to clients: `contact_number`, `email`, `remarks`, `commission_model`, `source`, `saffron_rating`, quote `notes` / `created_by` / `quote_text`, deadline `notes`, staff notification bodies, `created_by` across the board.

---

## B4. Assignment flow — how a vendor lands on a project

Entry points:
- `QuickAddVendorPanel` on the project page (fast add by search).
- `VendorProjectAssigner` from a vendor card's kebab (assign one vendor to multiple projects).

Steps:
1. Staff picks vendor(s) and project(s). UI calls a server fn that inserts/upserts one row per `(project_id, vendor_id)` in `project_vendors` (`ON CONFLICT DO NOTHING`).
2. New rows default `is_saffron_pick=false`. There's no per-project status here — reactions live in `client_vendor_status` per client.
3. The realtime channel bound to the project invalidates `["project-vendors", projectId]` and the client board queries.
4. If the project has assigned clients, the client's board immediately picks up the new card on next tick (no notification is created for "vendor added" unless explicitly wired).
5. Removing an assignment: admin-only. Deleting a `project_vendors` row does NOT cascade-delete quotes or comments (they're keyed on `(project_id, vendor_id)` directly and remain as historical records). To fully remove a vendor from a project, staff also clean quotes/comments manually.
6. A vendor can live on many projects at once. Every downstream table (`project_vendor_quotes`, `project_vendor_comments`, `project_category_deadlines`, `client_vendor_status`) is scoped independently, so per-project state doesn't leak between weddings.

Saffron Pick toggle: writes `project_vendors.is_saffron_pick`. Purely visual — it does not filter or reorder anything.

---

## B5. Quotes flow — full lifecycle

Data model. Many `project_vendor_quotes` per `(project, vendor)`. `buildQuoteSeqMap()` sorts by `created_at` and numbers them Q1, Q2, Q3 for display.

Lifecycle:

```text
           ┌──────────┐
  create → │ received │ ─ revise ─→ ┌──────────┐
           └──────────┘             │ revised  │ ─ revise ─→ (loop)
                │                   └──────────┘
                │                        │
                ├────── close ───────────┤
                ▼                        ▼
           ┌──────────┐             ┌──────────┐
           │ withdrawn│             │  closed  │  ← is_final=true (trigger enforced)
           └──────────┘             └──────────┘
```

- Only ONE quote per `(project, vendor)` may hold `is_final=true`. Setting `status='closed'` on any quote runs the `enforce_single_final_quote` trigger, which flips other siblings' `is_final` back to false.
- `quote_amount` = what the vendor quoted. `closed_amount` = what was actually booked at (often after negotiation). Rollups always use `closed_amount`.
- `withdrawn` retains the row for history but excludes it from booked totals.
- Files (`project_vendor_quote_files`) are stored in the `vendor-files` bucket under a per-quote folder; UI uses `SignedQuoteFileViewer` which resolves fresh signed URLs on open.

UI surfaces:
- `ProjectVendorQuotesPanel` — staff editor (add / revise / close / withdraw / attach files, per-line status pill, sequence badge Q1/Q2/…).
- `VendorQuoteHistory` — chronological timeline across projects for a single vendor.
- `SignedQuoteFileViewer` — inline PDF/image preview.

Client visibility (via server strip):
- Sees `quote_amount`, `currency`, `status`, `closed_amount`, `created_at`, and `files[]` file names + sizes (with signed-URL fetch for opens).
- Does NOT see `notes`, `quote_text`, or `created_by`.
- The `ClientVendorCard` `quote_summary` gives them `count`, `latest_status`, `latest_amount`, `has_closed`, `closed_amount` at a glance.

Rollups derived from quotes:
- **Vendor "Booked" badge**: any quote with `status='closed'` for that vendor in any project (staff view) or in *this* project (client view).
- **Project actual spend**: `Σ closed_amount over closed quotes + Σ actual_amount over project_other_expenses`.
- **Project planned spend**: `Σ (planned_amount from project_category_deadlines OR fallback per-category rollup) + Σ planned_amount from project_other_expenses`.
- **Category actual**: `Σ closed_amount for that category` unless `actual_amount_override` is set on the deadline row, which wins.

---

## B6. Statuses & indicators cheat sheet

**`client_vendor_status`** (personal to each client user):

| value | label | pill |
|---|---|---|
| `like` | We like it | terracotta soft |
| `thinking` | Need to think about it | slate |
| `shortlisted` | Shortlisted | amber |
| `finalised` | Finalised | emerald |
| `rejected` | Rejected | rose |

Progression is loose: `like → thinking → shortlisted → finalised`. `rejected` is terminal-but-reversible.

**`quote_status`**: `received | revised | closed | withdrawn`. Only `closed` counts toward booked/spend.

**Urgency (criticality × days-to-due)** — computed in `src/lib/urgency.ts`:

| criticality | future (>7d) | ≤7d | past due |
|---|---|---|---|
| high | red-soft | red | red-strong |
| medium | amber-soft | amber | red |
| low | blue-soft | blue | amber |
| none | neutral | neutral | amber |

**Saffron Pick** — pure highlight (light terracotta wash on card + row). Not filterable, not sortable, does not affect status.

---

## B7. End-to-end user journeys

**Staff: add vendor → assign → quote → book**
1. `/admin` vendor grid → "New vendor" → fills `VendorForm` → row lands in `vendors`.
2. Opens the target project → `QuickAddVendorPanel` → searches, selects, submits → `project_vendors` row created.
3. Opens the vendor row inside the project → `ProjectVendorQuotesPanel` → "Add quote" → status defaults to `received`, enters `quote_amount`, attaches files.
4. Negotiates offline, adds a follow-up quote with `status='revised'`.
5. Marks the winning quote `status='closed'`, enters `closed_amount`. Trigger sets `is_final=true` and unflags siblings.
6. "Booked" badge appears on the vendor card; project spend rollups update; client's dashboard reflects it via realtime.

**Vendor: self signup → review → import**
1. Public form at `/vendor-signup` posts to `/api/public/vendor-signup` → row in `inbound_leads` with `status='new'`.
2. Admin sees the queue on `/admin/submissions`.
3. Approve → server fn inserts into `vendors` with `submitted_via_form=true` and marks the lead `status='imported'`. Reject → `status='rejected'`.

**Client: log in → react → comment**
1. Signs in with email/password (invited only). `has_project_access` limits which project they see.
2. Lands on `/client` → Summary view (spend, upcoming deadlines, booked count).
3. Opens Board → drags a card from "We like it" to "Shortlisted" → writes `client_vendor_status` for that user.
4. Opens a vendor detail → posts a comment → row in `project_vendor_comments`.
5. Trigger side effect (server-fn): row in `staff_notifications` + email enqueued via `email_queue` → staff bell + inbox.
6. Staff replies → row in `project_vendor_comments` (as staff user) + `client_notifications` for the client + email.
