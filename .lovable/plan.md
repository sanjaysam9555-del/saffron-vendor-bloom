## Goal

Build a client portal where each wedding client logs in with credentials you provide, sees their bride & groom names + wedding date at the top, and views ONLY the vendors you've assigned to their project — with a restricted set of vendor fields.

Admins/employees get a new **Projects** area to create projects, set up the client login, and assign vendors. Additionally, vendors can be assigned to projects directly from the **vendor card and vendor detail panel** via a multi-select dropdown — a single vendor can belong to multiple projects, and the list of assigned projects is shown on both the card and the detail view.

---

## How it works (user flow)

### For you (admin / employee)
1. Open the new **Projects** section from the top nav.
2. **Create Project** → Bride name, Groom name, Wedding date, optional notes.
3. On the project page: **Add Client Login** (email + password you choose). Creates an auth user with role `client` linked to that project.
4. Assign vendors to a project either from:
   - **Project page → Assign Vendors** (search/filter full vendor list, multi-select), OR
   - **Any vendor card / vendor detail panel** → "Assign to projects" dropdown (multi-select of all projects). Tick/untick projects; saves immediately.
5. Both the vendor card and the detail panel display chips like `Aanya & Rohan`, `Priya & Karan` showing every project the vendor is currently assigned to. Chips are clickable (admin only) → opens that project page.
6. Share the client portal URL + credentials with the client out-of-band.

### For the client
1. They visit **`/client/login`** — a separate, branded login page (distinct from staff `/login`).
2. They sign in with their credentials.
3. They land on **`/client`**:
   - Header: `Aanya & Rohan • 14 Feb 2027`
   - One-liner: "Welcome — here are the vendors we think will be perfect for you."
   - Vendors grouped by Category. Each card shows ONLY: Subcategory, Vendor Name, Instagram, Price, Portfolio link, Attachments (download links).
4. Clients can't see any other route, project, or vendor field. Hitting `/` or `/admin/*` redirects to `/client`.

---

## Where the client logs in

Dedicated route: **`/client/login`** (separate from staff `/login`).

- Branded for clients, no "create admin" or employee messaging.
- After login, role-based routing sends `client` users to `/client`.
- One shared URL — the project a client sees is determined by their account, not the URL.

(Per-project slug URLs like `/client/aanya-rohan` are easy to add later if you want.)

---

## Data model (new tables)

```text
projects
  id (uuid, pk)
  bride_name (text, not null)
  groom_name (text, not null)
  wedding_date (date, not null)
  notes (text, nullable)
  created_by (uuid)
  created_at, updated_at

project_clients          -- which auth users can access which project
  id (uuid, pk)
  project_id (uuid → projects, on delete cascade)
  user_id (uuid)         -- the client's auth.users id
  created_at
  unique(project_id, user_id)

project_vendors          -- which vendors are visible to that project (M:N)
  id (uuid, pk)
  project_id (uuid → projects, on delete cascade)
  vendor_id (uuid → vendors, on delete cascade)
  created_at
  unique(project_id, vendor_id)
```

Plus: extend the existing `app_role` enum with **`client`** so the existing `user_roles` table handles client accounts the same way it does admin/employee.

### RLS rules

- `projects`, `project_clients`, `project_vendors`: admin/employee full access; clients can only `SELECT` their own project rows via a `has_project_access(_user_id uuid, _project_id uuid)` SECURITY DEFINER helper.
- `vendors`: existing policies stay. Clients won't query this table directly — a server function returns ONLY the whitelisted columns for their assigned vendors (defense-in-depth).
- `vendor_attachments`: clients can read attachments only for vendors assigned to their project (policy uses the helper).
- Storage bucket `vendor-files` is already public — no change needed.

---

## New / changed routes

```text
src/routes/
  client.login.tsx          -- client-only login page
  client.index.tsx          -- /client — read-only vendor view
  admin.projects.tsx        -- list + create projects
  admin.projects.$id.tsx    -- project detail: edit, manage client login, assign vendors
```

Updates:
- `src/components/AuthGate.tsx` — `client` role users redirected away from staff routes.
- New `src/components/ClientGate.tsx` — protects `/client`, requires role `client`.
- `src/components/vendor/TopNav.tsx` — add "Projects" link for admin/employee.
- `src/routes/login.tsx` — small note pointing clients to `/client/login`.
- `src/lib/auth.tsx` — add `'client'` to `AppRole`.

---

## Vendor → Projects assignment (from vendor UI)

New shared UI piece: **`<VendorProjectAssigner vendorId>`**
- Renders a "Assign to projects" dropdown (popover with checkbox list of all projects, plus a quick search).
- Multi-select; toggling a project triggers an immediate `assignVendorToProject` / `unassignVendorFromProject` call.
- Below the dropdown trigger, shows the current assigned projects as chips (e.g. `Aanya & Rohan ×`). Click `×` to remove.
- Used in both:
  - `src/components/vendor/VendorCard.tsx` — compact chip row + small "+ Assign" button (admin/employee only).
  - `src/components/vendor/VendorDetail.tsx` — full assigner with search.

Data:
- `useVendors()` query result extended with `assigned_projects: { id, bride_name, groom_name, wedding_date }[]` — fetched via a single batched query joining `project_vendors` + `projects` so the dashboard can render chips without N+1 calls.
- Mutations invalidate both `["vendors"]` and `["project", projectId]` queries.

---

## New server functions

`src/server/projects.functions.ts` (admin/employee unless noted):

- `listProjects()`
- `createProject({ bride_name, groom_name, wedding_date, notes })`
- `updateProject({ id, ... })`
- `deleteProject({ id })`
- `createProjectClient({ project_id, email, password, display_name })` — mirrors existing `createEmployee`; creates auth user with role `client`, inserts `user_roles` + `project_clients`.
- `resetProjectClientPassword({ user_id, password })` — same pattern as `setUserPassword` (updates + global sign-out).
- `assignVendors({ project_id, vendor_ids })` — replaces a project's assigned vendors set (used by the project page bulk picker).
- `assignVendorToProject({ project_id, vendor_id })` / `unassignVendorFromProject({ project_id, vendor_id })` — single-row upsert/delete used by the vendor-side assigner.
- `listAssignedVendors({ project_id })` — full vendor rows for the project page.
- `listVendorsWithProjects()` — extends the existing vendor list with `assigned_projects[]` for the dashboard.

Client side:
- `getMyProject()` — reads `project_clients` for `auth.uid()`, returns `{ project, vendors }` where vendors contain ONLY: `id, category, subcategory, vendor_name, instagram_handle, price_text, portfolio_link, attachments[]`. Runs under `requireSupabaseAuth`; whitelist guarantees no leakage.

---

## Auth model changes

- Extend `app_role` enum: add `'client'`.
- Update `handle_new_user` trigger to honor `user_metadata.role = 'client'` (same shape as employee).
- `useAuth` already exposes `role`; widen `AppRole` to include `'client'`.
- `AuthGate`: if `role === 'client'`, redirect to `/client`.
- New `ClientGate`: requires session + `role === 'client'`, otherwise → `/client/login`.

---

## Files touched

**New**
- `src/routes/client.login.tsx`
- `src/routes/client.index.tsx`
- `src/routes/admin.projects.tsx`
- `src/routes/admin.projects.$id.tsx`
- `src/components/ClientGate.tsx`
- `src/components/vendor/VendorProjectAssigner.tsx`
- `src/server/projects.functions.ts`
- `src/lib/project-types.ts`

**Modified**
- `src/lib/auth.tsx` — add `'client'` to `AppRole`
- `src/components/AuthGate.tsx` — redirect `client` away from staff routes
- `src/components/vendor/TopNav.tsx` — add "Projects" link
- `src/components/vendor/VendorCard.tsx` — show project chips + assigner
- `src/components/vendor/VendorDetail.tsx` — show project chips + assigner
- `src/lib/vendor-api.ts` / `src/hooks/useVendorData.ts` — include `assigned_projects` in vendor query
- `src/routes/login.tsx` — small pointer to `/client/login`

**Database (one migration)**
- Add `'client'` to `app_role` enum
- Create `projects`, `project_clients`, `project_vendors` tables
- Create `has_project_access(_user_id uuid, _project_id uuid)` SECURITY DEFINER function
- RLS policies on the three new tables + a client-read policy on `vendor_attachments`
- Update `handle_new_user` trigger (acknowledge `client` role from metadata)

---

## Out of scope (for now)

- Per-project branded URLs / custom slugs
- Client self-service password change (only admin can reset, like employees)
- Inquiries / messaging from client back to you
- Multiple projects per single client account
- Project archive / "completed" status
