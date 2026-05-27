# Fix: Create Employee creates clients

## Root cause

`handle_new_user` trigger on `auth.users` always assigns the `client` role (except for the first-ever user). It ignores the `role` set in `user_metadata`. So when `createEmployee` calls `supabaseAdmin.auth.admin.createUser({ user_metadata: { role: "employee" } })`, the trigger inserts a `client` row into `user_roles` and the metadata is silently ignored.

## Fix

In `src/server/admin-users.functions.ts` → `createEmployee` handler, after the `createUser` call succeeds, upsert the role to `employee`:

- Delete the auto-created `client` row in `user_roles` for the new `user_id` and insert `role = 'employee'` (single transaction via two admin calls, or `upsert` with conflict on `(user_id, role)` after deleting existing).
- The existing `enforce_staff_email_domain` trigger will validate the `@saffronevents.in` domain, so we should also validate the email in the input validator (or rely on the trigger to throw — which would leave an orphaned auth user). Better: validate domain in the zod schema before creating the user.

No DB migration needed.

## Files
- `src/server/admin-users.functions.ts` — add domain check in `inputValidator`; after `createUser`, replace the role row with `'employee'`.
