## Plan to fix client-side login loading

I found the backend is healthy and client accounts do exist, but the client login path can get stuck because role/access resolution still depends on browser-side role queries and the client gate waits forever when `role` never becomes `client`.

### 1. Make role resolution authoritative and fast
- Update `src/lib/auth.tsx` so `signIn()` and session restore use the existing server-side access resolver (`getCurrentUserAccess`) instead of browser RLS queries against `project_clients` / `user_roles`.
- Keep the current cache fallback only as a fallback, not the primary source.
- This should make client/admin/employee routing consistent after login.

### 2. Remove the infinite client loading state
- Update `src/components/ClientGate.tsx` so after auth initialization finishes:
  - no session sends users back to `/`
  - staff accounts go to `/admin`
  - unknown/no client access signs out or shows a clear access message instead of endless “Loading your portal…”
- Keep the loader only for real initialization/access checks.

### 3. Make the login button recover from failed routing/access checks
- Update `src/components/auth/UnifiedLoginForm.tsx` so if sign-in succeeds but no destination role is returned, it resets from loading/success and shows the access error.
- Ensure the form never remains permanently disabled.

### 4. Validate the fix
- Re-test the login flow in preview and inspect network/console signals for the client route.
- Confirm `/client` no longer stays stuck on the portal loader when auth/access resolution fails.