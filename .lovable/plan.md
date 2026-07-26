# Admin-Only Analytics Tab

Everything below is gated to `role === 'admin'`. Employees never see the tab, the commission field, or the payment ledger — anywhere in the app.

## 1. Database

**a) Commission on closed quotes**
- Add `commission_amount NUMERIC(12,2)` (nullable) to `project_vendor_quotes`.
- RLS: readable/writable by admin only via a dedicated policy; employees keep existing quote access but cannot read/write this column (enforced through an admin-only RPC for get/set; column excluded from client-facing selects).
- `closed_amount` stays the single client-facing figure — unchanged.

**b) New `project_payments` table** (admin-only)
- Fields: `project_id`, `label`, `expected_amount`, `received_amount`, `due_date`, `received_on`, `status` (pending / partial / received / overdue), `notes`.
- RLS: SELECT/INSERT/UPDATE/DELETE gated by `has_role(auth.uid(), 'admin')`. Employees and clients get nothing.

**c) Admin-only analytics RPCs**
- `admin_analytics_overview(from, to)` — totals: client billing, vendor cost, commission, received, pending.
- `admin_analytics_projects(from, to)` — per-project P&L rows.
- `admin_analytics_vendors(from, to)` / `admin_analytics_categories(from, to)` — performance rollups.
- Each RPC is `SECURITY DEFINER`, checks `has_role(auth.uid(),'admin')` at the top, EXECUTE granted to `authenticated` only.

## 2. New route `/admin/analytics` (admin only)

- New file `src/routes/admin.analytics.tsx` wrapped in `<AuthGate requireAdmin />`. Non-admins are redirected by the existing gate.
- Add nav link in `AdminShellHeader` rendered only when `role === 'admin'` (mirrors existing `AdminLink` pattern) — employees do not see the tab at all.

Sections on the tab:

**A. Overview cards** — date-range filter (This month / Quarter / Year / Custom)
- Total client billing · Total vendor cost · Total commission earned · Total received · Total pending.

**B. Per-project P&L table**
- Project · Client price · Vendor cost · Commission · Margin % · Received · Pending · Status. Sortable, links into project detail.

**C. Vendor & category performance**
- Top vendors by bookings + commission earned.
- Category spend + commission breakdown.

**D. Project payment ledger** (admin only)
- Pick a project → installment list with add/edit/mark-received.
- Also embedded as an admin-only card inside the existing admin project page — hidden for employees via `role === 'admin'` check.

## 3. Quote close flow

- In `ProjectVendorQuotesPanel` close dialog: **Commission** input rendered only when `role === 'admin'`.
- Employees continue to close quotes exactly as today, with no commission UI or data exposure.
- Editable later from the same panel, still admin-only.

## 4. Visual / motion

Reuse existing tokens, `FlipNumber`, `Reveal`. No new libraries.

## Technical notes

- Single migration: column + payments table + RLS + admin-only RPCs + `GRANT`s per project rules.
- New server fns: `src/lib/analytics.functions.ts`, `src/lib/project-payments.functions.ts`, `src/lib/quote-commission.functions.ts` — all use `requireSupabaseAuth` and re-check `has_role('admin')` inside every handler (defence-in-depth on top of RLS/RPC checks).
- New UI: `src/routes/admin.analytics.tsx` + `src/components/admin/analytics/{OverviewCards,ProjectPLTable,VendorPerformance,CategoryBreakdown,PaymentLedger}.tsx`.
- Client-facing components and employee views are not modified beyond hiding admin-only affordances.
