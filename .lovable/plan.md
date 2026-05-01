I inspected the current auth/routing/server-function code and the backend data. I found the main causes:

- The `/` page is overloaded: it is both the client login page and the admin vendor dashboard. If role resolution is delayed or fails, this can leave users stuck at “Loading…” or expose the wrong UI path.
- Client-facing routes rely on component-level redirects instead of hard route guards, so protected UI can render before role checks fully settle.
- Server functions still use mixed auth patterns. Some staff-only functions are safe, but client project loading still depends on middleware that can race with session hydration.
- The app fetches admin-only data eagerly on the root dashboard, and repeated auth lookups/parallel server calls are making the app feel slow.
- The database currently has the correct real roles for the visible users: `info@saffronevents.in = admin`, `gautam@saffronevents.in = employee`, and `sunilvats6919@gmail.com = client`. The leakage is in routing/auth state handling, not because that client currently has an admin role.

Plan to fix:

1. Separate client and admin entry points cleanly
   - Make `/` a client-only entry point that shows client login when signed out and redirects signed-in clients to `/client`.
   - Move the admin/vendor dashboard away from `/` to a dedicated route such as `/admin` or `/admin/vendors`.
   - Make `/login` the staff login page and only send staff users to the admin route.
   - Update all “Back to dashboard” and admin navigation links to the new admin route.

2. Add strict route guards so clients can never see admin UI
   - Create/strengthen a staff gate that only renders children after auth is fully loaded and role is `admin` or `employee`.
   - Create/strengthen an admin-only gate for user management.
   - Update the vendor dashboard and `/admin/projects` routes to use the staff gate.
   - Update client routes so staff/admin users are redirected away and clients stay in the client portal.
   - Do not render admin components while role is `null`, `loading`, or `client`.

3. Fix auth loading so the app cannot hang forever
   - Refactor `src/lib/auth.tsx` so role/profile loading has a bounded timeout and always settles `loading=false`.
   - Cache the current access result per session to avoid repeated `getCurrentUserAccess` calls.
   - Avoid firing duplicate profile loads from both `onAuthStateChange` and `getSession` for the same session.
   - If access lookup fails for a signed-in user, show a controlled error/sign-out option rather than an infinite “Loading…” screen.

4. Make client project loading resilient
   - Replace `getMyProject`’s middleware dependency with the same manual token-verification pattern already used by the repaired auth/vendor functions, but without any staff fallback.
   - Verify the caller has exactly a `client` role before returning client data.
   - Return a typed empty/error state for “no project assigned” instead of throwing into a blank/error state.
   - Ensure client project data only includes client-safe vendor fields.

5. Reduce slow page loads
   - Stop loading admin vendor data on `/` for everyone.
   - Only enable vendor/project queries after the correct role is known.
   - Combine or defer admin dashboard queries where practical so the first paint is faster.
   - Tune React Query settings to avoid unnecessary refetches on initial navigation.
   - Add graceful skeleton/error states rather than repeated retries that block the whole page.

6. Tighten backend role safety
   - Add a migration to enforce that a user cannot simultaneously have `client` and staff (`admin`/`employee`) roles.
   - Add a `project_clients.user_id` uniqueness constraint if each client account should belong to only one project, matching the current app behavior.
   - Add/repair the new-user trigger so server-created client accounts are assigned `client` when intentionally created by staff, while public/self signups never get privileged roles.
   - Re-run the database linter after changes and address any remaining obvious role/RLS warnings.

7. Verify the critical flows
   - Client login (`sunilvats6919@gmail.com`) should land on `/client`, not `/` or admin.
   - Admin login (`info@saffronevents.in`) should land on the dedicated admin dashboard.
   - Employee login should access staff/vendor/project tools but not admin user management.
   - Signed-out users should see only login/client portal entry, never dashboard data.
   - Reloading after login should not get stuck on “Loading…”.
   - Measure loading after the change and confirm unnecessary root/admin requests no longer fire for client sessions.

Once approved, I’ll implement these changes directly.