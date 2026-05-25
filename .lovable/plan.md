## Problem

On iPhone/iPad cold load, returning signed-in users briefly see the login form at `/` — its email/password inputs cause iOS to surface the keyboard — before the splash plays and the dashboard mounts.

Root cause: `src/routes/index.tsx` renders `UnifiedLoginForm` unconditionally. The redirect to `/admin` or `/client` only fires after `useAuth()` finishes restoring the Supabase session (`initialized === true` and `role` resolved), which takes a few hundred ms. During that window, the password input is in the DOM and iOS Safari's autofill/focus heuristics can pop the keyboard.

## Fix

Gate the index page so the login form only renders when we are sure the user is signed out.

In `src/routes/index.tsx`:
- Use `useAuth()` to read `initialized` and `session`.
- While `!initialized`, render an empty `<main>` with `min-h-screen bg-[var(--cream)]` (matches splash background so there is no flash, and `SplashScreen` is already overlaying on top via `__root.tsx`).
- If `initialized && session`, also render the empty cream `<main>` — the existing `useEffect` in `UnifiedLoginForm` that redirects authenticated users is moved up to the route component (or duplicated here) so navigation happens without mounting the form.
- Only when `initialized && !session` render the hero + `UnifiedLoginForm`.

This keeps the form fully functional for actual logged-out visitors and removes the input nodes during the auth-restore window, so iOS never sees inputs to focus.

## Files

- `src/routes/index.tsx` — add `useAuth` gate and the signed-in redirect effect; wrap existing JSX in the gated branch. No changes to `UnifiedLoginForm`, `SplashScreen`, or auth flow.
