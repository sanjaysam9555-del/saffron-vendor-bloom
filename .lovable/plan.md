I checked the current app instead of guessing. The slowness and failed logins are real, and there are a few concrete causes we can fix.

What I found:

1. Login can fail because the form submits before JavaScript is ready
- Your current URL includes `?email=...&password=...`, and the session replay shows the login page doing a normal browser navigation to `/login?email=...&password=...`.
- That means the login form was submitted before the React submit handler had hydrated/attached.
- Result: the app reloads like an old website, the login does not run, and the password is exposed in the URL query string.

2. Initial load is currently too close to or above 3 seconds
- On the published domain I measured roughly:
  - TTFB: about 1.4s
  - First contentful paint: about 2.26s
  - Full page load: about 2.85s
- On preview/dev it is worse because preview loads many separate development modules; that part is expected in Lovable preview, but the published site still needs optimization.

3. The login/dashboard flow has too many sequential waits
- Cold open does: load document -> load JS -> restore auth storage -> ask backend for role -> redirect -> load admin route -> fetch vendors/projects/assignments.
- That creates a waterfall, so the app feels like it reloads from page to page.

4. Dashboard cards trigger unnecessary backend work
- Every vendor card mounts `VendorProjectAssigner`, and each instance sets up project/assignment queries. React Query deduplicates some of it, but 292 vendor cards still create lots of hook work and render overhead.
- The assignment UI should not load on every card by default. It should load once at dashboard level or lazily only when the assign button is opened.

5. Some refetch settings make the app feel unstable on mobile
- Queries refetch on focus/reconnect and the vendor hook also invalidates on visibility change. On iPhone PWA, switching apps or reopening can cause repeated loading states.

Plan to fix this properly:

1. Make login reliable and stop URL password leakage
- Update all login forms so they cannot submit as a plain GET before hydration.
- Add `method="post"`, remove any chance of query-string credential submission, and disable/show “Preparing secure sign-in…” until the client handler is ready.
- Clear existing `email`/`password` query params from the URL immediately if present.
- Make successful login navigate immediately once role is known; avoid extra cosmetic delays.

2. Reduce auth startup waterfall
- Hydrate role from the existing local cache immediately for returning users.
- Only call the backend role check in the background if the cached user matches.
- Ensure protected pages wait for auth readiness without bouncing to the client login page first.
- Keep server validation for security; the cache is only for instant UI routing, not authorization.

3. Optimize dashboard data loading
- Fetch vendors once, but avoid rendering project assignment logic on every card.
- Move project/assignment loading to a single parent-level query or lazy-load it only when the user taps “+ Project”.
- Keep the card list lightweight so 292 vendors render quickly on mobile.

4. Tune mobile refetch behavior
- Increase dashboard query stale time and disable aggressive `refetchOnWindowFocus` for heavy dashboard data.
- Keep manual/realtime refresh where useful, but avoid repeated full reloads when the iPhone app is reopened.
- Show cached dashboard data instantly while background refresh happens.

5. Improve first paint and perceived speed
- Reduce login-page work so sign-in screen becomes interactive faster.
- Avoid loading dashboard-only code during login as much as the route setup allows.
- Keep the logo splash only for actual auth restoration/route transitions, not as a mask for repeated reloads.

6. Verify after implementation
- Re-test published-style timings and login behavior.
- Confirm submitting login never produces `/login?email=...&password=...` again.
- Confirm dashboard opens directly for an already logged-in admin in the iPhone-sized viewport.
- Confirm vendor dashboard no longer triggers unnecessary repeated project assignment query work.

The highest-priority fix is the login form hydration issue, because it explains both “logins fail” and the old-style page reload behavior.