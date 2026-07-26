## Analytics tab restructure

### 1. Header nav
- `src/components/admin/DashboardSwitch.tsx`: add third segment "Analytics" (BarChart3 icon), route `/admin/analytics`. Active when path starts with `/admin/analytics`.
- `src/components/UserMenu.tsx`: remove `AnalyticsLink` export usage.
- `src/components/admin/AdminShellHeader.tsx`: drop `<AnalyticsLink />`.
- `DashboardSwitch` renders the Analytics segment only when `role === 'admin'` (using `useAuth`).

### 2. Analytics page cleanup (`src/routes/admin.analytics.tsx`)
- Remove "Back to dashboard" link.
- Overview cards → 3 cards only: **Client Billing**, **Vendor Cost**, **Commission**. Drop Received/Pending.
- Per-project P&L table → columns: Project, Wedding, Client Price, Vendor Cost, Commission, Margin. Drop Received/Pending.
- Move Project Payments section directly below P&L (before vendor/category performance).

### 3. Project Payments table (replaces dropdown ledger)
New flat table, one row per project, editable inline. Columns:

```
Project | Closed Amount | Total Installments | Inst 1 | Inst 2 | Inst 3 | Inst 4 | Total Received | Remarks
```

- Each installment cell shows the amount; cell background = green when received, amber when pending (toggle via click or a small ✓ button inside the cell to mark received/unreceived and set `received_on`).
- "Total Received" auto-computes from installments.
- "Remarks" is an editable text field (debounced save).
- Total Installments is set at project creation (1–4) and locked here (edit only via project edit).
- Closed Amount is read-only, equals sum of closed quotes for the project (already available from analytics_projects RPC).

### 4. Data model changes
Add to `projects` table:
- `total_installments SMALLINT NOT NULL DEFAULT 1 CHECK (total_installments BETWEEN 1 AND 4)`

Auto-seed `project_payments` rows on project creation:
- On `createProject`, after insert, generate N installment rows with `label = 'Installment k'`, `expected_amount = closed_amount / N` placeholder (0 initially since no closed quotes yet), `status = 'pending'`, `installment_no = k`.
- Add `installment_no SMALLINT` column to `project_payments` to order them 1..N.

New admin RPC / server fn `listProjectPaymentsMatrix(range)`:
- Returns one row per project: `{ project_id, names, wedding_date, closed_amount, total_installments, installments: [{no, expected, received, received_on, status}], total_received, remarks }`.
- Remarks stored on project row as `payment_remarks TEXT NULL`.

Server fns:
- `updateInstallment({project_id, installment_no, expected_amount?, received_amount?, status?, received_on?})` — upserts on `(project_id, installment_no)`.
- `updateProjectPaymentRemarks({project_id, remarks})`.

### 5. Create Project dialog
`src/components/admin/CreateProjectDialog.tsx`:
- Add required "Number of installments" select (1/2/3/4).
- Pass to `createProject`; server fn seeds N `project_payments` rows.

### 6. Files touched
- Migration: add `projects.total_installments`, `projects.payment_remarks`, `project_payments.installment_no`, unique index `(project_id, installment_no)`, backfill defaults, new admin RPC.
- `src/lib/projects.functions.ts`: accept `total_installments`, seed installments.
- `src/lib/project-payments.functions.ts`: add matrix listing + inline update fns.
- `src/routes/admin.analytics.tsx`: rewrite overview cards, P&L columns, replace `PaymentLedger` with `PaymentsMatrixTable`.
- `src/components/admin/DashboardSwitch.tsx`, `AdminShellHeader.tsx`, `UserMenu.tsx`.
- `src/components/admin/CreateProjectDialog.tsx`.

### Open question
For projects created before this migration, default `total_installments = 1` and seed one installment with expected = closed amount. OK?
