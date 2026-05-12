I found two concrete problems that explain the new login breakage and the “nothing happens / page refreshes” feeling:

1. The login UI is still a native HTML form with `method="post" action="/"`. If hydration is delayed or interrupted, clicking Sign In can fall back to a real page submit/refresh instead of the React login handler.
2. The auth listener calls role/database work during the auth state callback. That can race or block the auth client during sign-in, causing stuck states. The dashboard also fires many per-card “booked summary” requests immediately after login, which makes the post-login screen feel jammed.

Plan:

1. Make login submission impossible to native-refresh
   - Replace the login `<form method="post" action="/">` behavior with a client-only submit flow.
   - Make the Sign In button use explicit click handling, not browser form submission fallback.
   - Keep Enter key support, but route it through the same client handler.
   - If JavaScript is not ready yet, the button should do nothing rather than refresh the page.

2. Stabilize the auth flow
   - Change the auth state listener so it only stores the session immediately.
   - Defer any role/profile/database lookups outside the auth callback.
   - Keep one in-flight role resolution per user so login does not double-query or deadlock.
   - Make `signIn()` return a clear error if role resolution fails, without silently returning to the login screen.

3. Make role resolution more reliable
   - Prefer the existing server-side access resolver for login role checks, so staff/client access is checked consistently and does not depend on fragile browser-side RLS timing.
   - Keep the `saffronevents.in` staff shortcut, but still verify admin/employee access correctly.

4. Stop dashboard request storms after login
   - Replace the per-card `BookedBadge` query pattern with one bulk booked-summary query for visible vendors.
   - Pass summary data into cards/details instead of letting every card trigger its own request.
   - This should remove the dozens of repeated `vendor_booked_summary` requests currently visible in the network log.

5. Verify the fix
   - Test invalid credentials: no page refresh, inline error appears.
   - Test valid session behavior where possible: login moves directly to the correct dashboard.
   - Check network after landing on `/admin`: no burst of repeated booked-summary calls per card.
   - Confirm dashboard data, Instagram previews, search results, detail page, and comments still load.