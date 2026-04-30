## Goal

On the admin project detail page (`/admin/projects/$id`), the "Client login" table currently only allows password reset and removal. Add the ability to edit a client's login email inline. On save, the auth user's email is updated so the client signs in with the new address.

## Changes

### 1. New server function — `setProjectClientEmail`
File: `src/server/projects.functions.ts`

- Method POST, protected by `attachAuthToken` + `requireSupabaseAuth` + `assertStaff`.
- Input: `{ user_id: uuid, email: valid email }` validated with Zod.
- Calls `supabaseAdmin.auth.admin.updateUserById(user_id, { email, email_confirm: true })` so the new email is immediately usable (no verification email required, matching how the account was originally created).
- Returns `{ ok: true }`.

### 2. UI — inline email editor in `ClientRow`
File: `src/routes/admin.projects.$id.tsx`

In the existing `ClientRow` component:
- Add a small pencil button next to the email cell (mirroring the pattern in `admin.users.tsx`).
- Toggling it swaps the email text for an `<input type="email">` with Save (check) and Cancel (X) buttons.
- Save calls the new `setProjectClientEmail` server function, then invokes `onChanged()` to refresh the project query.
- Show inline error if the call fails (duplicate email, invalid, etc.).
- Keep existing password-reset and remove actions unchanged.

## Notes

- No DB migration needed — email lives on `auth.users`, which `getProject` already reads via the admin client.
- Changing the email does not invalidate active sessions; only password changes call `signOut`. This matches user expectations for an email change.
