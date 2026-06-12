## Goal

Track non-vendor line items (Dhol Wala, Heaters, Coolers, Transport, "Other") per project — they have **planned** and **actual** cost only. They roll up into budget totals but **never** appear in the timeline ribbon or urgency strip.

## Why a new table (not extending `project_category_deadlines`)

The existing deadlines table is the source of truth for what shows on the timeline. Reusing it with a "hide me" flag would mean filtering it out of `buildTimelineItems`, the urgency strip, the notifications, and the deadline editor — and we'd still have to special-case the missing `due_date` and `criticality` everywhere. Cleaner to keep the two concerns separate.

## Data model

New table `project_other_expenses`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid fk → `projects.id` on delete cascade | |
| `label` | text not null | e.g. "Dhol Wala", "Transport" |
| `planned_amount` | numeric null | INR |
| `actual_amount` | numeric null | INR (entered manually, no auto-resolve) |
| `notes` | text null | staff-only |
| `sort_order` | int default 0 | for stable ordering |
| `created_by`, `created_at`, `updated_at` | standard | `touch_updated_at` trigger |

Indexes: `(project_id)`, unique `(project_id, lower(label))` to prevent dupes.

GRANTs + RLS:
- `GRANT SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `GRANT ALL` to `service_role`.
- Policies (using existing helpers `has_role` and `has_project_access`):
  - Staff (admin/employee) full read/write.
  - Clients SELECT only when `has_project_access(auth.uid(), project_id)`.
  - No anon access.

## Server functions

New file `src/lib/project-other-expenses.functions.ts`:
- `listProjectOtherExpenses({ project_id })` — staff sees all columns; clients see all except `notes` (mirrors deadlines pattern).
- `upsertProjectOtherExpense({ project_id, id?, label, planned_amount, actual_amount, notes, sort_order })` — staff only.
- `deleteProjectOtherExpense({ id })` — admin only (matches existing deadline delete).

All use `requireSupabaseAuth` + `attachAuthToken`; admin/staff checks via `has_role`/`has_project_access`.

## Admin UI

Inside `/admin/projects/$id` → **Budget & Deadlines** tab, below the existing `VendorTimeline`, add a new section **"Other expenses"**:
- Card with a small table: Label · Planned (₹) · Actual (₹) · Notes · row actions (save/delete).
- "+ Add expense" inline row at the bottom (label + planned + actual + notes + save).
- Five suggested presets shown as quick-add chips on first use: Dhol Wala, Heaters, Coolers, Transport, Other expense. Clicking a chip prefills `label` in the add row — user can still type anything.
- Edits use the same optimistic-mutation pattern as the deadline editor.

New component: `src/components/timeline/OtherExpensesPanel.tsx`.

## Client UI

In `/client` Budget/Summary area, show the same "Other expenses" list as a **read-only** card (label · planned · actual). Hidden if the project has zero rows. Included in the budget totals tile (`ClientSummaryStats`):
- `actuals` gets `+ sum(actual_amount)` from other-expenses.
- Planned-vs-actual rollup in `VendorTimeline`'s TableView footer adds the same.

The timeline ribbon, urgency strip, "needs attention" notifications, and category cards stay untouched — these items have no due date and no vendor list.

## Files to add / change

- `supabase/migrations/<new>.sql` — table, grants, RLS, trigger.
- `src/lib/project-other-expenses.functions.ts` — server fns.
- `src/components/timeline/OtherExpensesPanel.tsx` — shared admin/client panel (mode prop).
- `src/routes/admin.projects.$id.index.tsx` — render `OtherExpensesPanel mode="admin"` under the timeline tab.
- `src/routes/client.index.tsx` — fetch other-expenses, render `OtherExpensesPanel mode="client"` in the Budget view.
- `src/components/client/ClientSummaryStats.tsx` — extend `actuals` with other-expenses sum.
- `src/components/timeline/VendorTimeline.tsx` (TableView totals) — extend planned/actual totals with other-expenses sum (passed in as a prop).
- Realtime: register `project_other_expenses` in the existing `useRealtimeInvalidate` setups for both admin and client.

## Verification

- Admin adds "Dhol Wala — planned 8000, actual 7500" → row persists, totals on the Budget tab footer rise by those amounts.
- Client logs in → sees the same row read-only in Budget, totals tile reflects it; timeline ribbon and "needs attention" are unchanged (no new category appears).
- Delete row (admin) → disappears for client on next realtime tick.
- Try to upsert as a client via devtools → 403/Forbidden.
