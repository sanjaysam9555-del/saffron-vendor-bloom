# Restore live authentication

## Confirmed diagnosis

The published site is running a bundle without the browser-side Lovable Cloud auth URL and publishable key. The browser reports both values as missing, and no sign-in request reaches the auth service. The backend itself is healthy, the admin account exists with the correct role, and the role/profile access policies are present.

## Plan

1. Rebind the project’s managed Lovable Cloud environment so the canonical browser and server auth variables are available to builds.
2. Replace the fragile browser client fallback with a production-safe configuration path that fails clearly without relying on server-only variables in browser code.
3. Keep credentials managed by Lovable Cloud; do not hardcode private keys or expose privileged credentials.
4. Publish a fresh production build so the repaired browser configuration reaches the custom domain.
5. Verify the real live flow end to end:
   - Confirm the sign-in request reaches auth and succeeds.
   - Confirm the admin role lookup succeeds and redirects to the admin dashboard.
   - Confirm a client account resolves as client and redirects to the client portal.
   - Refresh both authenticated destinations to confirm session persistence.
   - Check for browser console errors and failed auth/network requests.

## Completion criteria

- Live admin login works on `planwithsaffron.in`.
- Live client login works on the same domain.
- Refreshing an authenticated page does not sign the user out or start a reload loop.
- The published browser bundle no longer reports missing auth configuration.
