## Goal

Stop showing "Other expenses" as a separate panel. Treat each row in `project_other_expenses` as a line item in the existing Budget & Deadlines table (same layout as Hotels & Venues), with admin edit/delete inline, and add their amounts to the dashboard totals. They stay **off** the timeline ribbon, urgency strip, category cards, and horizontal timeline — table only, as you said.

## What the user will see

### Budget table (admin and client)
A new row per "other" expense alongside vendor categories. Columns reuse the existing layout:

```
Category          | Vendors | Due date | Days left | Criticality | Status | Planned | Actual    | (admin: actions)
------------------+---------+----------+-----------+-------------+--------+---------+-----------+------------------
Hotels & Venues   |    3    | 12 Jul   |  30 days  | High        | Plan…  | ₹2.0L   | ₹1.8L     | Edit
Dhol Wala         | Others  |    —     |    —      |    —        |   —    | ₹15,000 | ₹15,000   | Edit  Delete
Transport         | Others  |    —     |    —      |    —        |   —    | ₹40,000 | ₹38,000   | Edit  Delete
```

- "Vendors" cell shows the label **Others** (not a number) for these rows, with a subtle pill style so they're visually distinguishable.
- Due date / Days left / Criticality / Status all render `—` because these aren't scheduled.
- Totals row at the bottom of the table includes Other rows (planned + actual).

### Admin controls
- A small "+ Add other expense" button above the table (admin only) opens an inline editor row with the same quick-add chips (Dhol Wala / Heaters / Coolers / Transport / Other expense) and Label / Planned / Actual / Notes inputs.
- "Edit" on an Other row expands an inline editor (Label, Planned, Actual, Notes) — same UX shape as the vendor `DeadlineEditor`, just without the date/criticality/booking fields.
- "Delete" button (admin only, with confirm) calls the existing `deleteProjectOtherExpense` fn.

### Dashboard tiles
- "Booked" tile: each Other expense counts as 1 booked row (since there's nothing to schedule), so the `X / Y` reflects them.
- "Spend" tile: includes the sum of Other actuals (already partially wired via `extraActuals`; switch to deriving from the merged items list instead).
- Vendor folio count tile is unchanged (it counts `ClientVendor` records, which Others aren't).

## Technical notes

### Data shape
Extend `TimelineItem` (`src/lib/urgency.ts`) with two optional fields:
- `kind?: "vendor" | "other"` (default `"vendor"`)
- `other_expense_id?: string` (so admin edit/delete know the row id)

### Merge point
In `src/routes/admin.projects.$id.index.tsx` and `src/routes/client.index.tsx`, the existing query that builds the `items: TimelineItem[]` already runs `listProjectOtherExpenses` for `extraActuals`. Map those rows into synthetic `TimelineItem`s:

```ts
const otherItems: TimelineItem[] = otherExpenses.map(e => ({
  category: e.label,
  vendor_count: 0,
  due_date: null,
  criticality: "low",
  notes: e.notes,
  booked: true,                   // not scheduled; treated as a settled line
  booked_vendor_name: null,
  planned_amount: e.planned_amount,
  closed_amount_auto: e.actual_amount,
  actual_amount_override: null,
  kind: "other",
  other_expense_id: e.id,
}))
const mergedItems = [...vendorItems, ...otherItems]
```

### View filtering
Helpers that drive the timeline visuals filter Others out:
- `HorizontalTimeline`, vertical timeline, category cards, `UrgencyStrip`, and the "needs attention" notification builders all consume `items.filter(i => i.kind !== "other")`.
- `TableView` and dashboard total reducers consume the full `mergedItems`.

### TableView changes (`src/components/timeline/VendorTimeline.tsx`)
- `TableRow`: when `item.kind === "other"`, render "Others" pill in the Vendors cell, `—` for date/days/criticality/status, and swap the edit panel for a new lightweight `OtherExpenseEditor` (label + planned + actual + notes). Add a Delete button in the actions cell next to Edit (admin only).
- `OtherExpenseEditor` wraps `upsertProjectOtherExpense` (already exists) using the row's `other_expense_id`.
- Above the table in admin mode, render an "+ Add other expense" button that toggles an inline add row using the same editor with no id (insert path).

### Files touched
- `src/lib/urgency.ts` — extend `TimelineItem`.
- `src/components/timeline/VendorTimeline.tsx` — TableView row variant, inline editor, "+ Add other expense", filter out `"other"` from non-table views, include Others in totals.
- `src/routes/admin.projects.$id.index.tsx` — merge Others into items; remove `OtherExpensesPanel`; drop `extraActuals` plumbing.
- `src/routes/client.index.tsx` — same merge; remove panel; drop `extraActuals`.
- `src/components/client/ClientSummaryView.tsx` — drop `extraActuals` prop now that items carry the data.
- `src/components/client/ClientSummaryStats.tsx` — no change to logic (already sums actuals across items), totals automatically include Others.
- Delete `src/components/timeline/OtherExpensesPanel.tsx`.

### Server / DB
No schema or server-function changes — `listProjectOtherExpenses`, `upsertProjectOtherExpense`, `deleteProjectOtherExpense` already cover everything. Realtime invalidation for `project_other_expenses` stays as-is.

### Verification
- Admin adds "Heaters ₹10,000 planned / ₹9,500 actual" → appears as a table row with "Others" pill, Spend tile rises by ₹9,500, Booked count includes it.
- Admin edits actual to ₹11,000 → table + dashboard update; client view mirrors via realtime.
- Admin deletes the row → confirm dialog → row disappears for both admin and client; totals drop.
- Timeline ribbon, urgency strip, category cards, and "needs attention" notifications show no "Heaters" entry.
- Client cannot edit or delete (no actions column for them on those rows; server fns still enforce).
