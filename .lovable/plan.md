# Budget & Deadlines Tab

Rename the project's "Booking Timeline" tab to **Budget & Deadlines** and add per‑category budget tracking alongside the existing deadline/booking info. Visible to both admins and clients (clients read-only on budgets).

## What changes for the user

Per vendor category (rows already shown today), two new amounts appear:

- **Planned** — the budgeted amount admin enters for that category.
- **Actual** — auto-filled from the booked vendor's closed quote (`closed_amount`); admin can type an override that wins over the auto value.

A **totals row** at the bottom sums Planned and Actual across all categories. Variance (Actual − Planned) is shown next to the totals.

Clients see the same Planned / Actual / Totals but cannot edit.

Tab is renamed everywhere from "Booking Timeline" → **Budget & Deadlines** (admin tab button + heading inside the panel).

## Implementation

### 1. Database
Migration on `project_category_deadlines`:
- Add `planned_amount numeric` (nullable)
- Add `actual_amount_override numeric` (nullable)

No new RLS — existing policies on the table already cover admin write / staff read / client read of their project. No GRANT changes needed.

### 2. Server (`src/server/project-deadlines.functions.ts`)
- Extend `CategoryDeadline` type with `planned_amount` and `actual_amount_override`.
- Extend `upsertCategoryDeadline` input schema and upsert payload with both fields (nullable numbers, min 0).
- Update SELECT in `listProjectCategoryDeadlines` to include the new columns.

### 3. Timeline data shape (`src/lib/urgency.ts` + `src/lib/build-timeline-items.ts`)
- Add to `TimelineItem`: `planned_amount: number | null`, `closed_amount_auto: number | null` (from booked vendor's `quote_summary.closed_amount`), `actual_amount_override: number | null`, plus a derived `actual_amount` (`override ?? auto`).
- In `buildTimelineItems`, when picking the booked vendor for a category, also capture its `closed_amount`. Merge `planned_amount` and `actual_amount_override` from the deadlines map.

### 4. UI (`src/components/timeline/VendorTimeline.tsx`)
- Heading text: "Booking Timeline" → "Budget & Deadlines".
- Card view (`CategoryRow`): show two compact pills under the category — `Planned ₹X` and `Actual ₹Y` (muted when null). If `override` is set, show a small "manual" tag on Actual.
- Table view: add **Planned** and **Actual** columns; add a totals `<tfoot>` row summing both with INR formatting (use `formatINR` from `quote-types.ts`).
- `DeadlineEditor`: add two number inputs — Planned amount and Actual amount override (placeholder shows the auto closed amount if any; empty value clears override). Wire into the existing save mutation.

### 5. Admin tab button (`src/routes/admin.projects.$id.index.tsx`)
- Change the visible label `Booking Timeline` → `Budget & Deadlines`. Internal state key `"timeline"` stays unchanged.

### 6. Client view (`src/routes/client.index.tsx`)
- No structural change — `VendorTimeline` in `mode="client"` will simply render the new columns/totals without edit affordances. UrgencyStrip label stays as-is.

## Technical notes
- Totals ignore null values (a missing Planned doesn't count as 0 in either column but the sum simply adds what's present).
- `actual_amount` resolution: `actual_amount_override ?? closed_amount_auto`. If neither, show "—".
- INR formatting via existing `formatINR` helper.
- No changes to quote tables; auto‑actual is read‑through from existing `quote_summary.closed_amount` already loaded for vendors.
