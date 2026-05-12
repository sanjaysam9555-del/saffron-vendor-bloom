## What's actually happening

The splash hangs on every page that involves auth (admin, client, and `/`) because every gate has the same shape:

```text
if (!initialized || loading || !session || !role) return <BrandSplash />;
```

If the `getCurrentUserAccess` server call is slow, throws, or returns `null` (token race, transient network blip, expired refresh token, runtime-error retry), `role` never becomes a string while `session` is truthy. The gates then show `BrandSplash` indefinitely — there is no terminal "role resolution failed" branch.

Symptoms reproduce because:
- `AuthGate` (admin/admin sub-pages) waits on `role`.
- `RedirectingLogin` on `/` waits on `role` to know where to redirect; with a cached user it holds the splash even longer.
- `ClientGate` already has a recovery path (signOut → `/`) but only after `initialized && !loading`, so it can stall too.

Server logs are all 200 and there are no DB errors, which matches the "client just never settles `role`" diagnosis.

There is also a separate, preview-only runtime error: `Failed to fetch dynamically imported module: /@id/virtual:tanstack-start-client-entry`. That happens when the Vite dev server rebuilds while a tab is open and the previously-requested entry chunk is gone. It looks identical from the user's side ("page stuck loading") and should be recovered automatically.

## Fix

1. **AuthProvider — add a definitive "role failed" signal.**
   - Add `roleResolutionFailed: boolean` to the auth state.
   - In `loadProfile`, set it `true` when the catch branch fires AND no usable cached role exists, otherwise reset to `false`. Always reset on `signOut` and on a fresh user.
   - Drop the safety timeout from 4s → 2.5s so we get out of the splash faster on cold boot.

2. **AuthGate — escape hatch.**
   - If `initialized && !loading && session && !role`: call `signOut()` and `navigate({ to: "/" })`. This converts the infinite splash into a clean bounce to the login screen. The user can then sign in again and we re-fetch the role.
   - Keep current cached-role fast path so already-authenticated staff don't see a flash.

3. **ClientGate — same pattern, slightly earlier.**
   - Already bounces when `!role`; tighten the condition so it does not also require `!loading`. The `inFlightRef` dedup already prevents duplicate fetches; we don't need to wait for `loading=false` to decide we have no role after `initialized`.

4. **`/` (RedirectingLogin) — don't trap signed-in users on the splash.**
   - If `initialized && session && !role` and `roleResolutionFailed` is true, sign out and reveal the login form instead of holding the splash via `hasCachedUser`.
   - Shorten the `hasCachedUser` grace window from 2500ms → 1500ms so logged-out devices clear stale cache faster.

5. **Recover from stale preview chunks.**
   - In `src/router.tsx` (or a small `src/lib/chunk-recover.ts` mounted from `__root.tsx`), add a one-time `window.addEventListener("error", …)` and `unhandledrejection` listener that detects messages matching `/Failed to fetch dynamically imported module/` and `location.reload()`s once per session (guarded by `sessionStorage` flag to prevent reload loops).
   - This is the standard Vite pattern; safe in production because the same error string is what the build emits when a hash chunk goes 404 after a redeploy.

6. **No backend / RLS / migration changes.** Server logs are clean; the recent profiles RLS tightening is unrelated (it only restricted reads done via the user JWT, and the role lookup uses `supabaseAdmin`).

## Files to change

- `src/lib/auth.tsx` — add `roleResolutionFailed`, shorter safety timeout, reset on signOut.
- `src/components/AuthGate.tsx` — bounce on `session && !role` after init.
- `src/components/ClientGate.tsx` — bounce earlier, no `loading` gate.
- `src/routes/index.tsx` — reveal login when role resolution failed; shorten cache grace.
- `src/lib/chunk-recover.ts` (new) + import from `src/routes/__root.tsx` — auto-reload on dynamic-import-fetch failure (once per session).

## Verification

- Hard reload `/admin` and `/client` while signed in — splash clears within ~2s, page renders.
- With localStorage cache present but session expired, `/` reveals the login form within ~1.5s instead of staying on the splash.
- Simulate `getCurrentUserAccess` failure (block `/_serverFn/*` in DevTools) — admin page bounces to `/` cleanly instead of hanging.
- Trigger a Vite rebuild while preview is open — the page reloads itself once and recovers.
