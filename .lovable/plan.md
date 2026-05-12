## Goal
Make the site usable again by removing auth race conditions, eliminating duplicate login routes, and reducing full-screen loading blocks across homepage, login, admin, and client portals.

## Plan

### 1. Make `/` the single public entry
- Put the quick Saffron introduction and unified login form directly on `planwithsaffron.in` (`/`).
- Keep exactly one visible vendor action: **Vendor sign up** linking to `/vendor-signup`.
- Stop using separate visible client/admin login screens.
- Make `/login` and `/client/login` render the same unified login experience or quietly route users to `/` only for backward compatibility; no app links will point there.

### 2. Replace the current auth flow with a small deterministic state machine
- States: `initializing → signedOut → signingIn → resolvingAccess → signedIn → accessError`.
- On sign-in, the button stays loading only until auth + access are resolved.
- Then show the green tick briefly, one small success notification, and immediately open the right dashboard.
- Remove paths that show “signed in successfully” while never navigating.
- Remove any automatic/silent logout except for truly invalid access, such as a staff role on a non-Saffron email.

### 3. Make role resolution fast and predictable
- Use email domain as a fast path:
  - `@saffronevents.in` accounts are treated as staff candidates and resolved against `user_roles` for `admin` / `employee`.
  - Non-Saffron emails skip staff checks and resolve as clients through `project_clients`.
- Enforce the rule that admin/employee accounts must use `@saffronevents.in`; if an account has staff role but does not match the domain, block access and sign it out with a clear error.
- Keep server-side role checks in place for security; the email shortcut improves speed but is not the only protection.

### 4. Remove loading traps
- Homepage splash remains capped at 600ms only.
- `AuthGate` and `ClientGate` will no longer show a full-screen splash forever; they will either render, show a small inline “checking access” state with a short cap, or send the user back to the single login section.
- Replace `RouteProgress` full-screen splash with a lightweight top progress indicator so route changes never hide the whole app for 6 seconds.
- Login/dashboard gates will wait for `initialized && role`, not just `session`, before running protected data queries.

### 5. Prevent dashboard queries from racing auth
- Admin and client data queries will only run after auth is initialized and the correct role is known.
- Realtime subscriptions will only start after the relevant data/project/vendor IDs exist.
- Instagram preview bulk calls will be disabled when there are no vendor IDs and deferred so they do not block first paint.

### 6. Improve perceived and real speed
- The public landing page will load instantly with minimal auth work.
- Dashboard first paint will show layout/skeletons instead of full-screen splash.
- Reuse cached dashboard query data for short revisits, but never use stale role cache to bypass fresh access checks.
- Keep expensive dashboard add-ons, such as Instagram previews, secondary to the core vendor/project data.

### Files to update
- `src/lib/auth.tsx` — rebuild auth state, sign-in, role/access resolution, and error handling.
- `src/routes/index.tsx` — single public landing + embedded unified login + vendor signup link.
- `src/routes/login.tsx` and `src/routes/client.login.tsx` — make them compatibility-only, not separate login experiences.
- `src/components/AuthGate.tsx` and `src/components/ClientGate.tsx` — remove full-screen stuck splash behavior.
- `src/components/RouteProgress.tsx` — replace full-screen splash with lightweight progress.
- `src/hooks/useVendorData.ts`, `src/routes/client.index.tsx`, and admin project routes — gate queries/subscriptions on ready auth role.
- `src/hooks/use-instagram-previews.ts` — prevent unnecessary preview calls from blocking page load.

## Validation
- Check first visit to `/` renders intro + login within the 600ms cap.
- Test successful staff login opens `/admin` promptly.
- Test successful client login opens `/client` promptly.
- Test failed login resets cleanly with one error.
- Test revisits do not get stuck on splash/login success.
- Review browser performance/network signals after the change to confirm fewer blocking states and no repeated auth/query loops.