## Goal

Per-project, per-category booking deadlines (Model B): a category appears in the timeline only after at least one vendor in that category is assigned to the project. Urgency is computed live from the due date + admin-set criticality baseline. Both admin and client see the same data; client lands on dashboard with an always-visible urgency strip + a new Timeline tab.

## Data model

New table `project_category_deadlines`:
- `id` uuid pk
- `project_id` uuid (logical FK to `projects.id`)
- `category` text (matches `vendors.category` / `categories.name`)
- `due_date` date
- `criticality` text — `'low' | 'medium' | 'high'`, default `'medium'`
- `notes` text nullable
- `created_by` uuid nullable, `created_at`, `updated_at`
- Unique `(project_id, category)`
- `touch_updated_at` trigger

RLS:
- Staff (admin/employee): ALL.
- Clients: SELECT where `has_project_access(auth.uid(), project_id)`.

Realtime: add `project_category_deadlines` to `supabase_realtime` publication.

No changes to `projects`, `project_vendors`, `vendors`, or quotes tables.

## Server functions (`src/server/project-deadlines.functions.ts`)

All protected with `requireSupabaseAuth`.

- `listProjectTimeline({ project_id })` — staff OR project client. Returns:
  ```ts
  {
    wedding_date: string;
    items: Array<{
      category: string;
      vendor_count: number;
      due_date: string | null;
      criticality: 'low'|'medium'|'high' | null;
      notes: string | null;
      booked: boolean;
      booked_vendor_name: string | null;
    }>
  }
  ```
  Source: `SELECT DISTINCT v.category FROM project_vendors pv JOIN vendors v ON v.id = pv.vendor_id WHERE pv.project_id = $1` left-joined with `project_category_deadlines`, plus a per-(project, category) booked check from `project_vendor_quotes (status='closed')` OR `client_vendor_status='finalised'`.

- `upsertCategoryDeadline({ project_id, category, due_date, criticality, notes })` — staff only.
- `deleteCategoryDeadline({ project_id, category })` — staff only (used when admin wants to clear).

## Urgency model (UI-only, derived)

```text
booked                                  → Booked    (green, locked)
days_left ≤ 0 && !booked                → Overdue   (red)
0 < days_left ≤ 7                       → Urgent    (orange)
7 < days_left ≤ 14                      → Due soon  (amber)
14 < days_left ≤ 30                     → Plan soon (blue)
days_left > 30                          → Upcoming  (muted)
no due_date                             → Needs deadline (admin: amber CTA; client: neutral "planner will set this")
```

Baseline `criticality='high'` bumps each bucket up one level; `'low'` softens one. `useNow()` ticks every 60s so urgency rolls over without a page reload.

Tokens added to `src/styles.css`: `--urgency-overdue`, `--urgency-urgent`, `--urgency-soon`, `--urgency-plan`, `--urgency-upcoming`, `--urgency-booked` (oklch).

## Shared UI

`src/components/timeline/VendorTimeline.tsx` — reused by admin and client.

Props: `{ projectId, weddingDate, items, mode: 'admin' | 'client' }`.

Internal Timeline / Table sub-toggle:
- **Timeline view**: vertical list grouped by urgency bucket (Overdue → Urgent → Due soon → Plan soon → Upcoming → Needs deadline → Booked). Wedding date pinned at top.
- **Table view**: columns Category | Vendors assigned | Due date | Days left | Criticality | Status. Default sort: `due_date` asc, Booked sinks to bottom.

Row expand → lists the assigned vendors in that category with their current `client_vendor_status` (read from existing query, no new fetch).

Admin mode adds inline editor (date picker + Low/Med/High select + notes) and a "Save" action wired to `upsertCategoryDeadline`.

`src/components/timeline/UrgencyStrip.tsx` — compact horizontal chip strip showing only Overdue / Urgent / Due soon items (max 4, "+N more"). Hidden if empty. Click chip → switch to Timeline tab + scroll to row.

## Admin integration

In `src/routes/admin.projects.$id.tsx`:
- Add **Booking Timeline** section above Assigned Vendors.
- Banner at top: "N categories have no deadline set yet" with jump-to-row.
- Uses `VendorTimeline mode="admin"`.
- `useRealtimeInvalidate` already subscribed to `project_vendors`, `project_vendor_quotes`, `client_vendor_status`; add `project_category_deadlines`.

## Client integration

In `src/routes/client.index.tsx`:
- **UrgencyStrip** pinned under `ClientTopNav`, full width, always rendered (hidden if no urgent items).
- Main view toggle gets a third option: `Table | Board | Timeline`. Selecting Timeline replaces the vendor area with `VendorTimeline mode="client"`.
- Clicking a chip in the strip sets the active tab to Timeline and scrolls to the target category row via `scrollIntoView`.
- Realtime: extend the existing client subscription to include `project_category_deadlines`.

## Data fetching

TanStack Query keys:
- `["project-timeline", projectId]` for `listProjectTimeline`.

Both admin and client pages prime via `ensureQueryData` in their existing loaders (or first render) and read with `useSuspenseQuery`. Mutations (`upsertCategoryDeadline`, `deleteCategoryDeadline`) invalidate `["project-timeline", projectId]`.

## Out of scope for v1

- Email/in-app notifications when a category tips into Urgent/Overdue (follow-up using existing `staff_notifications` + transactional email infra).
- Auto-suggested due dates from wedding date.
- Per-vendor (not per-category) deadlines.
- Bulk-seed deadlines.
