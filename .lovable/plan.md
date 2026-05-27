# Lock down delete access to admins only

Employees currently have delete access in several places — both via RLS policies that group all CRUD under "Staff manage X", and via server functions gated to `staff` (admin OR employee) rather than `admin`.

## DB migration: split "Staff manage X" policies

For each table below, drop the `FOR ALL` staff policy and replace with separate policies: SELECT/INSERT/UPDATE for staff, DELETE for admin only.

- `projects`
- `project_clients`
- `project_vendors`
- `project_vendor_quotes`
- `project_vendor_quote_files`
- `project_category_deadlines`
- `vendor_instagram_previews`
- `instagram_backfill_jobs`

Also change `project_vendor_comments` → "Staff delete any comment" from staff to admin only. (Clients can still delete their own; comment authors keep delete rights through the existing "Clients delete own comments" policy, which applies to any author including staff via `user_id = auth.uid()`.)

Tables already correct (admin-only delete): `vendors`, `categories`, `inbound_leads`, `vendor_attachments`, `user_roles`.

## Server functions: change `assertStaff` → `assertAdmin` for delete handlers

These bypass RLS via `supabaseAdmin`, so app-level gating is the only check:

- `src/server/projects.functions.ts`
  - `removeProjectClient` (deletes `project_clients` + auth user)
  - `unassignVendorFromProject`
  - delete-comment handler (around line 1130) — admin or comment author only
- `src/server/vendors.functions.ts`
  - `deleteVendorServer`
  - `bulkDeleteVendorsServer`
- `src/server/project-deadlines.functions.ts`
  - `deleteCategoryDeadline`

Leave alone:
- `assignVendorsBulk` — performs delete-then-insert to "replace set" of assigned vendors. This is a bulk-assign action, not a delete action. Keep as staff. (Flagging for awareness.)
- `updateClientVendorStatus` — clients deleting their own status row, unchanged.
- `deleteProject`, `deleteUser` — already admin-only.

## UI

No UI changes in this pass. Delete buttons will simply error for employees. (Can hide later if desired.)

## Out of scope

Storage bucket `vendor-files` policies — staff currently have full access via the `Staff manage quote files` / `Staff insert attachments` table policies. Storage objects themselves are server-mediated (signed URLs from server fns), and the `vendor_attachments` row delete is already admin-only, so an employee cannot delete an attachment record. Quote file deletion goes through `project_vendor_quote_files` RLS which this plan changes to admin-only delete.
