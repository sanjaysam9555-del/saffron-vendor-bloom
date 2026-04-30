## Goal

1. Remove the misleading "Temporary password" wording — it was just placeholder text, not a feature. The password admin sets is the employee's actual password; employees cannot change it.
2. Make admin password resets actually log the employee out everywhere (so they're forced to sign back in with the new password), matching what we agreed.

## Changes

### 1. Fix the wording (`src/routes/admin.users.tsx`)

- Change the create-employee password input placeholder from `"Temporary password (min 6)"` to `"Password (min 6)"`.
- Add a small helper line under the form: "The employee will use this password to sign in. They cannot change it — only you can reset it from this page."
- In the `UserRow` reset-password UI, change the button label from "Reset password" to "Change password" and confirm copy: "This will sign the employee out of all sessions."

### 2. Force employee sign-out on password change (`src/server/admin-users.functions.ts`)

In the existing `setUserPassword` server function, after the admin updates the password, also revoke that user's active sessions using the admin client:

```ts
await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
// New: invalidate all existing JWTs for this user
await supabaseAdmin.auth.admin.signOut(user_id, "global");
```

`signOut(userId, "global")` revokes all refresh tokens for that user. Their current access token will stop working on its next refresh (within ~1 minute on most clients), and they'll be redirected to `/login` by `AuthGate`.

### 3. (Optional, nicer UX) Detect revoked session on the client (`src/lib/auth.tsx`)

The existing `onAuthStateChange` listener already handles `SIGNED_OUT`. No change needed — when Supabase fails to refresh the revoked token, it fires `SIGNED_OUT` automatically and `AuthGate` will bounce them to `/login`.

## Files touched

- `src/routes/admin.users.tsx` — wording only
- `src/server/admin-users.functions.ts` — add `signOut` call after password update

## Out of scope

- No DB migration needed.
- No new routes.
- Employee self-service password change remains intentionally absent.
