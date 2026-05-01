## Fix vendor delete: "Authentication is still loading" race

The Confirm Delete button is firing before the Supabase session token is attached to the request, so the server function rejects it with "Authentication is still loading. Please try again." and the vendor never gets deleted. We'll fix the underlying race and improve the messaging so this stops happening.

### Root cause

`src/server/auth-client-middleware.ts` (the `attachAuthToken` client middleware) calls `supabase.auth.getSession()` once. If the session hasn't hydrated yet — or the access token just expired — it sends the request with no `Authorization` header. The server (`src/server/vendors.functions.ts → requireStaffUser`) then throws the generic "Authentication is still loading." error. The same message also fires for genuinely invalid tokens, which is misleading.

The detail dialog `handleConfirmDelete` correctly toasts on error and resets `deleting`, so the dialog stays open and the vendor row stays in the DB — exactly what the screenshot shows.

### Changes

**1. `src/server/auth-client-middleware.ts` — make token attach robust**
- Try `supabase.auth.getSession()` first.
- If no token, call `supabase.auth.refreshSession()`.
- If still no token, poll `getSession()` for up to ~2s (5 attempts, 400ms apart) — covers the case where the session is hydrating from storage during initial load.
- Only after that fall through with no Authorization header.

**2. `src/server/vendors.functions.ts` — clearer error + same hardening for all staff actions**
- Split the two error cases in `requireStaffUser`:
  - No bearer token → `"You're not signed in. Please sign in again to continue."`
  - `getUser(token)` rejects → `"Your session expired. Please sign in again."`
- No behavior change beyond message clarity. (`listVendorsServer`, `createVendorServer`, `updateVendorServer`, `deleteVendorServer`, `bulkInsertVendorsServer` all benefit because they share `requireStaffUser`.)

**3. `src/components/vendor/VendorDetail.tsx` — gate the Confirm Delete button on auth readiness**
- Read `const { initialized, session } = useAuth();` (already importing from `@/lib/auth`).
- The Confirm Delete button is `disabled` while `!initialized || !session` (in addition to the existing `deleting || deleted` checks).
- Tooltip / label shows "Preparing…" in that brief window so the user understands why it's not clickable. Once auth is ready (the common case), the button works immediately.
- No change to the success flow: on resolve, `setDeleted(true)` + `toast.success("Vendor deleted")` + `modals.closeDetail()` (called from `admin.index.tsx`'s `onDelete`) close the dialog; the React Query `invalidate` in `useVendorData` removes the row from the dashboard.

### Out of scope
- No DB / RLS / migration changes — the delete itself works once the token reaches the server.
- No changes to `admin.index.tsx` wiring (close-on-success is already correct).
- No changes to the success toast styling.
