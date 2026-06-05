## Problem

On the client-side Time tab (both Timeline and Table views), every row shows "—" for **Planned Budget** and **Actual Cost**, and the header totals come out as ₹0.

## Root Cause

`src/lib/project-deadlines.functions.ts` → `listProjectCategoryDeadlines` intentionally strips `planned_amount` and `actual_amount_override` for non-staff callers:

```ts
const cols = staff
  ? "..., planned_amount, actual_amount_override, ..."
  : "id, project_id, category, due_date, criticality, updated_at";
...
if (!staff) {
  return list.map((r) => ({ ...r, notes: null, planned_amount: null, actual_amount_override: null }));
}
```

So `buildTimelineItems` receives `planned_amount: null` for every category on the client, and the `VendorTimeline` totals/rows render "—" / ₹0. The auto-actual (`closed_amount_auto`) is already wired through `getMyProject.quote_summary.closed_amount`, so once `planned_amount` and `actual_amount_override` are returned, both Planned and Actual numbers will populate for clients.

## Fix

Expose `planned_amount` and `actual_amount_override` to clients in `listProjectCategoryDeadlines`. Keep `notes` and `created_by` staff-only (those are internal planner-only fields).

### Change — `src/lib/project-deadlines.functions.ts`

- Select `planned_amount` and `actual_amount_override` for both staff and clients.
- Keep `notes` blanked for clients (still staff-only).
- Update the inline comment to reflect the new policy: budget figures are visible to clients; only internal notes are staff-only.

No schema change, no RLS change (the function already runs as `supabaseAdmin` with explicit `assertCanRead`), no client component changes — `VendorTimeline` already renders these fields when present and `getMyProject` already returns `closed_amount` in `quote_summary`.

## Out of Scope

- Admin Timeline / Table views (already working).
- Editing budgets from the client side — clients remain read-only.
- Exposing `notes` or `created_by` to clients.
- Any RLS policy change on `project_category_deadlines`.

## Verification

After the change, on the client Time tab:
- Header shows real Planned, Actual, Variance totals.
- Each category row shows Planned Budget and Actual Cost (auto from closed quotes, or the override if set).
- Table view footer totals match.
