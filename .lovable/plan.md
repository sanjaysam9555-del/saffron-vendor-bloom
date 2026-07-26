## Add a project-level "Analytics" tab (admin-only)

Add a fourth tab in the project page tab row, visible only to admins, that mirrors the master Analytics page but scoped to a single project.

### Tab bar

In `src/routes/admin.projects.$id.index.tsx` (`ProjectSectionTabs`):
- Extend `tab` union to include `"analytics"`.
- Render a 4th tab pill "Analytics" (BarChart3 icon) only when `useAuth().role === "admin"` — same terracotta-active styling.
- Order: Assigned Vendors, Budget & Deadlines, Project Details, Analytics.

### Tab contents (new `ProjectAnalyticsTab` component)

Reuse the visual language and helpers from `admin.analytics.tsx` (`OverviewCard`, table styles, dark charcoal header rows, formatINR).

1. **Callout cards row** — Client Billing (terracotta highlight — matches vendor cost tone used in master? Actually master uses: Client Billing default, Vendor Cost terracotta, Commission emerald). Use the same 3-card layout and same color mapping:
   - Client Billing (neutral)
   - Vendor Cost (terracotta)
   - Commission (emerald)
   Values computed from this project's closed quotes + commissions.

2. **Project P&L table** — single-row table (or itemized per vendor) with the same columns as master P&L minus Received/Pending. Show per-closed-vendor: Vendor, Category, Client price (closed), Vendor cost, Commission. Footer totals row.

3. **Project Payments** — reuse the existing `PaymentsMatrixTable` UI but for just this one project (single-row matrix): Closed Amount (planning_fee), Total Installments selector (1–4), Installment 1–4 status cells, Total Received, Total Pending, Remarks. Inline-editable, identical UX to master.

4. **Commission Tracking table (new)** — one row per closed vendor for this project. Columns:
   - Vendor
   - Category
   - Closed Amount (client price)
   - Commission (amount)
   - Total Installments selector (default 2, range 1–4)
   - Installment 1 / 2 / 3 / 4 status cells (Received / Pending / Partial / Overdue), editable inline with amount + received-on
   - Total Received (sum)
   - Total Pending
   - Remarks (inline)
   - Footer totals row
   Same dark charcoal header, zebra rows, color-coded status cells as master payments matrix.

### Backend (`supabase--migration`)

New table `public.vendor_commission_payments` to store per-quote commission installments:
- `id`, `project_id` (FK projects), `quote_id` (FK project_vendor_quotes, unique constraint with installment_no), `vendor_id`, `installment_no smallint (1–4)`, `expected_amount numeric`, `received_amount numeric`, `received_on date`, `status` (pending/partial/received/overdue), `notes`, `created_by`, timestamps.
- GRANT to authenticated + service_role; RLS: admin-only via `has_role(auth.uid(),'admin')`.
- Add `total_commission_installments smallint default 2` and `commission_remarks text` to `project_vendor_quotes` (only meaningful when quote is closed).
- New RPC `admin_project_commission_matrix(_project_id uuid)` returning one row per closed quote with `installments jsonb` (same shape as `admin_payments_matrix`).
- New RPC `admin_project_analytics_overview(_project_id uuid)` returning `{client_billing, vendor_cost, commission}` for that project only (subset of `admin_analytics_overview`).
- New RPC `admin_project_pnl(_project_id uuid)` returning per-closed-vendor rows.

### New server functions (`src/lib/project-analytics.functions.ts`)

Admin-gated (same `assertAdmin` pattern as `analytics.functions.ts`):
- `projectAnalyticsOverview({project_id})`
- `projectPnl({project_id})`
- `listCommissionMatrix({project_id})`
- `upsertCommissionInstallment({quote_id, installment_no, expected_amount?, received_amount?, received_on?, status?})`
- `updateQuoteCommissionInstallmentCount({quote_id, total_installments})`
- `updateQuoteCommissionRemarks({quote_id, remarks})`

Project Payments reuses existing `listPaymentsMatrix`/`upsertInstallmentSlot` etc., filtered client-side to `project_id === id` (or add a `project_id` filter param — cleaner: extend `listPaymentsMatrix` to accept optional `project_id`).

### Reuse

Extract shared sub-components from `admin.analytics.tsx` into `src/components/admin/analytics/` (`OverviewCard`, `PaymentsMatrixTable`, `StatusCell`) so both master and project analytics render identically. If extraction risks regressions, duplicate minimally instead — noted as fallback.

### Access control

- Tab hidden for non-admin roles.
- Server functions assert admin.
- RPCs use `SECURITY DEFINER` + `has_role` check (same pattern as existing analytics RPCs).

### Out of scope

No changes to client-facing screens. Vendors still see only closed price, never commission.
