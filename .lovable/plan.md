# Fix: iPhone PWA still flashes login before dashboard

## New hypothesis (different from prior attempts)

Prior fix made the **SSR HTML** at `/` render only the splash — verified by curling the live site, which now returns only "Saffron Planning" brand markup, no login form. So the **first paint is correct**. The flash the user reports is happening **after hydration**, in `RedirectingLogin`.

Walk through the cold-boot path:

1. iOS paints SSR splash (good — verified).
2. React hydrates. `RedirectingLogin` mounts: `openingPlate=true` → splash continues.
3. After 800ms, `openingPlate=false`.
4. Meanwhile, `useAuth()` is calling `supabase.auth.getSession()` which reads from IndexedDB/localStorage. On iPhone PWA cold boot, this can take **>800ms** to resolve because iOS suspends storage access.
5. So at t=800ms we have: `openingPlate=false`, `initialized=false` → still splash (good).
6. Eventually `getSession()` resolves with a session → `setInitialized(true)` and `setSession(s)` happen in the same synchronous block. So we render `BrandSplash` (signed-in branch).
7. Then `loadProfile` fires; redirect effect waits for `role`. Once role is loaded, `navigate('/admin')` fires.

**The actual race:** between step 6 and the navigate completing, React renders once with `initialized=true, session=null` if Supabase momentarily returns null before the persisted session deserializes. Or — more likely — there's a render where `session=null` was the initial state, `initialized` is still false, but the 800ms timer already fired, and the `!initialized` check holds it. Let me re-read…

Actually the gap is here: `setInitialized(true)` is called inside `getSession().then(...)`. If `s` is null momentarily (race with `onAuthStateChange` firing INITIAL_SESSION), the component renders with `initialized=true, session=null` → falls through to login form for one frame before the next state update.

## Fix

Add a synchronous guard that reads our own `localStorage` cache key (`saffron.access.cache.v1`) at component mount. If a cached role exists, this device has a previously signed-in user — we MUST keep the splash up until either the redirect fires or session is confirmed null after a real signOut. No transient `session=null` render can flash the login form.

This also covers the "OLD installed PWA" case: if the user installed the app before previous fixes, that install persists. The cached role survives across reloads, so the splash holds.

### Single file change: `src/routes/index.tsx`

In `RedirectingLogin`:

```tsx
// Read synchronously at mount — does this device have a cached signed-in user?
const [hasCachedUser] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("saffron.access.cache.v1");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { role?: string | null };
    return Boolean(parsed?.role);
  } catch {
    return false;
  }
});
```

Then add a render branch after the existing `if (session) return <BrandSplash />;`:

```tsx
// Device had a cached signed-in user — never flash the login form on
// cold boot. The cache is cleared on signOut (see auth.tsx writeCachedAccess(null)),
// so genuinely-logged-out users will fall through after their next signOut.
if (hasCachedUser) return <BrandSplash />;
```

The cache cleanup on signOut already exists in `src/lib/auth.tsx` (line: `writeCachedAccess(null)` inside `signOut`), so this branch self-heals.

### Risk: stale cache after token expiry

If the user's Supabase session expired but `saffron.access.cache.v1` is still set (e.g. they didn't actively sign out), they'd be stuck on the splash. Mitigate with a 5-second safety: if `initialized=true && session=null && hasCachedUser`, clear the cache and reveal the login form.

```tsx
// Safety: if auth confirms no session (token expired), clear stale cache.
useEffect(() => {
  if (initialized && !session && hasCachedUser) {
    try { window.localStorage.removeItem("saffron.access.cache.v1"); } catch {}
    // Force a re-render to drop the splash by reloading once. Better:
    // just let the next branch check fall through after we set local state.
    // Simplest: setHasCachedUser(false) — but it's a const from useState.
    // Switch hasCachedUser to a state with setter so we can clear it.
  }
}, [initialized, session, hasCachedUser]);
```

Refactor `hasCachedUser` to `[hasCachedUser, setHasCachedUser]` so the safety effect can clear it.

## Files changed

- `src/routes/index.tsx` — add synchronous cached-user check + safety effect to clear stale cache.

## Verification after edit

1. Curl `/` again — should still SSR only the splash (already verified).
2. Build should succeed.
3. Behavior on iPhone PWA: cold boot → splash → dashboard, no login flash even if Supabase session restore is slow. Logged-out users (no cache key) → splash → login form, unchanged.
