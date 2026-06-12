
## Goal
Make Other Expense rows behave like vendor-category rows everywhere — table, ribbon, and horizontal timeline — with the only differences being:
- Vendors column shows `NA`.
- No quotes/closing flow; entering an Actual amount auto-marks the row as Booked.

## Changes

### 1. Database
Add `due_date` (date, nullable) to `project_other_expenses` so Others can carry a deadline like vendor categories.

### 2. Server function (`src/lib/project-other-expenses.functions.ts`)
- Add `due_date` to `OtherExpense` interface, select columns, Zod schema, and insert/update payloads.
- In the upsert handler: if `actual_amount` is non-null, force `booked = true` regardless of client value (so "actual entered ⇒ booked" is enforced server-side).

### 3. Timeline plumbing
- `src/lib/build-timeline-items.ts → otherExpensesAsTimelineItems`: set `due_date: r.due_date ?? null`, and set `booked: r.booked || r.actual_amount != null` so urgency/views reflect the rule even if older rows aren't migrated.
- Stop filtering Others out of the timeline views: in `VendorTimeline.tsx`, drop the `vendorOnly` filter (or rename `items` source) so ribbon + horizontal timeline consume the full item list, including `kind === "other"`.

### 4. Ribbon + Horizontal Timeline (`src/components/timeline/VendorTimeline.tsx`)
- Render Others identically to vendor categories. No special "Others" badge in the card body.
- Card vendor-count area → render `NA` when `kind === "other"`; existing styling otherwise unchanged.
- Clicking the card opens the existing inline editor for that row (table-side); ribbon/horizontal click handlers already scroll to the table row by category — works as-is.

### 5. Table row (`OtherTableRow`)
Rewrite to mirror `TableRow` 1:1:
- Border-left coloured by `BUCKET_TOKEN[bucket]` (drop champagne accent and cream tint).
- Drop the `OTHERS` pill.
- Vendors cell → plain text `NA`.
- Due date → `formatDueDate(item.due_date)` or `—`.
- Days left → `daysLeftLabel(daysLeft)` (— when booked or no date).
- Criticality → plain capitalised text.
- Status → `Booked` (green) or `BUCKET_LABEL[bucket]` — same as vendor rows.
- Planned + Actual + Edit button identical.

### 6. Editors (`OtherExpenseEditor`, `AddOtherExpenseDialog`)
- Add a Due date `<input type="date">` field.
- Remove the Status select — booked is derived from Actual:
  - Actual empty ⇒ pending; Actual filled ⇒ booked.
- Show a small inline hint under Actual: "Entering an actual amount marks this as booked."
- Save payload includes `due_date`; server clamps `booked` from `actual_amount`.

### Out of scope
- No changes to vendor-category rows.
- No quote/closing flow for Others (intentionally absent).
