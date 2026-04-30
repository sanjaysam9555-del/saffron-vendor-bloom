## Goal

Add authentication with two roles:

- **Admin** — full control: add, edit, delete vendors/categories/attachments + manage employees (create them, change their username/password)
- **Employee** — can add and edit vendors/categories/attachments, but **cannot delete** anything and **cannot change their own password or username**

Plus an **Admin → Users** page where the admin manages employees.

---

## What the user will see

1. **Login page** at `/login` — email + password.
2. After login, app loads as today. Top-right shows the current user's name, role badge ("Admin" / "Employee"), and a Sign out button. Admin also sees an **"Admin"** link.
3. **Vendor cards / detail / category manager** — Delete buttons are hidden for Employees. Edit and Add still work.
4. **Admin page** at `/admin/users` (admin-only) — list of all users with role badges, plus:
   - "Create Employee" button (email + temporary password)
   - For each employee: rename (display name), reset password, delete user
5. Anyone not signed in is redirected to `/login`.

---

## Data model

New tables in Lovable Cloud:

- `profiles` — `user_id` (FK to `auth.users`), `display_name`, `created_at`. Auto-created on signup via trigger.
- `app_role` enum: `admin` | `employee`.
- `user_roles` — `user_id`, `role`. Roles live in their own table (never on profiles) to avoid privilege-escalation. Unique on (user_id, role).
- Security-definer function `has_role(_user_id, _role)` for safe RLS checks.

The existing `vendors`, `vendor_attachments`, `inbound_leads` tables get **tightened RLS**:

- SELECT / INSERT / UPDATE — any authenticated user.
- DELETE — only `has_role(auth.uid(), 'admin')`.
- Public anon access removed (no more open `USING (true)` for everyone).

The first user to sign up is bootstrapped as **admin**; subsequent users default to **employee** (handled in the signup trigger).

---

## Auth & permissions wiring

- Use Lovable Cloud's email + password auth (no email confirmation, so admin-created employees can log in immediately).
- A small `useAuth()` hook subscribes to `supabase.auth.onAuthStateChange` and loads the current user's role + display name from `user_roles` + `profiles`.
- A `useIsAdmin()` helper drives conditional rendering of Delete buttons and the Admin link.
- Routes are guarded with TanStack `_authenticated` layout (`beforeLoad` redirect to `/login`) and `_authenticated/_admin` layout for the admin page.

Admin user-management calls (create employee, reset password, delete user, rename) need the **service role** key, so they go through three small TanStack server functions in `src/server/admin-users.functions.ts`:

- `listUsers()` — admin only, lists everyone with role + display_name.
- `createEmployee({ email, password, display_name })`.
- `setUserPassword({ user_id, password })`.
- `deleteUser({ user_id })`.

Each verifies the caller is admin server-side using the auth middleware before doing anything privileged.

---

## File changes

**New**
- `supabase/migrations/...` — profiles, user_roles, app_role enum, has_role function, signup trigger, tightened RLS on vendors/vendor_attachments/inbound_leads.
- `src/lib/auth.tsx` — AuthProvider + `useAuth()` + `useIsAdmin()` hook.
- `src/routes/login.tsx` — login form.
- `src/routes/_authenticated.tsx` — auth guard layout.
- `src/routes/_authenticated/index.tsx` — moves current home page here.
- `src/routes/_authenticated/_admin.tsx` — admin guard.
- `src/routes/_authenticated/_admin/users.tsx` — Admin → Users page.
- `src/server/admin-users.server.ts` + `src/server/admin-users.functions.ts` — server functions for admin user CRUD.
- `src/components/UserMenu.tsx` — top-right user badge + sign-out.

**Modified**
- `src/routes/__root.tsx` — wrap in `AuthProvider`.
- `src/routes/index.tsx` — content moves under `_authenticated/index.tsx`; this file becomes a redirect or is deleted.
- `src/components/vendor/TopNav.tsx` — adds `<UserMenu />` and (for admins) an "Admin" link.
- `src/components/vendor/VendorDetail.tsx`, `VendorCard.tsx`, `CategoryManager.tsx` — hide Delete buttons for non-admins.
- `src/lib/categories.ts` — `deleteCategory` already calls Supabase; protected by RLS now (employees will get a friendly error if they try).

---

## Initial setup the user does once

1. After I deploy, the user opens the app and is redirected to `/login`.
2. They click **"Create the first admin account"** on the login page (visible only when no users exist) and sign up with their email + a password — this becomes the admin.
3. They open Admin → Users and create the employee account (email + temp password) and share the credentials.

No emails or external services are required.

---

## Out of scope (for now)

- Google / SSO sign-in (can be added later).
- Password reset via email (admin reset is enough for a 2-user setup).
- Per-vendor ownership / audit log of who edited what (can be added later).
