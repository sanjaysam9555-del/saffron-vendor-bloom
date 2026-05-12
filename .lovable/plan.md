## Goal

Make sign-in fast, predictable, and free of the toast/redirect/splash loops by collapsing three login surfaces into one and removing the role-resolution race.

## What changes

### 1. One sign-in page: `/login`
- `/login` becomes the single sign-in form for clients **and** staff (one form, one set of fields).
- `/client/login` is removed (kept as a 1-line redirect to `/login` so any old link still works).
- Homepage `/` returns to a clean marketing page with a prominent **Sign in** button → `/login`. The embedded login form on `/` is removed (it is the source of most race conditions because it runs alongside the splash/role logic).

### 2. Splash capped at 600ms
- `BrandSplash` shown on `/` only during the opening plate, hard-capped at **600ms** (down from ~800 + indefinite role wait).
- After 600ms, whatever the auth state is, the page reveals — no "stuck on splash" path.

### 3. Sign-in flow (the actual fix)
On `/login` submit:
1. Call `signIn(email, password)`.
2. Button stays in `loading` state while we **await role resolution** (already implemented in `loadProfile` but currently fire-and-forget). We add a single `await` so the button only flips to `success` once `role` is known.
3. As soon as `role` is `admin`/`employee` → navigate to `/admin`. If `client` → `/client`.
4. Exactly **one** toast on success, **one** toast on failure. Remove the duplicate "Logged out" toast that fires when role lookup fails (cause: `signOut()` was being called as a fallback — already removed, but we'll also suppress the toast on any system-initiated `signOut`).

### 4. Auth context cleanup (`src/lib/auth.tsx`)
- `signIn` returns `{ error, role }` and awaits `loadProfile` so callers know exactly when to navigate.
- Remove the cached-role hydration branch on `/` (no longer needed — `/` doesn't auth-gate anything).
- Keep the 3-attempt retry on role lookup, but on final failure: **do not** sign the user out, **do not** show a toast. The login page shows an inline "Couldn't load your account — try again" with a retry button.
- Drop the `roleResolutionFailed` branching from `RedirectingLogin` (gone with the homepage form removal).

### 5. Gates simplify
- `AuthGate` (admin) and `ClientGate` (client) just check `session && role`. While `loading`, show a small inline spinner — not a full-page splash. No more "Try again" component, no more silent sign-outs.

## Files touched

- `src/routes/login.tsx` — single unified form (email + password + Sign in). Awaits role, then navigates.
- `src/routes/index.tsx` — strip embedded login form; marketing copy + "Sign in" CTA. Splash capped 600ms.
- `src/routes/client.login.tsx` — replace body with `<Navigate to="/login" replace />`.
- `src/lib/auth.tsx` — `signIn` awaits `loadProfile`; removes the silent-signout fallback path; trims unused state.
- `src/components/AuthGate.tsx`, `src/components/ClientGate.tsx` — simplify to `session && role` with inline spinner; drop `AccessRetry`.
- `src/components/client/ClientLoginForm.tsx` — kept only for use inside `/login` (or delete if `/login` form covers it). Remove `setTimeout(... 250)` hack.
- `src/components/BrandSplash.tsx` — no change needed; cap is enforced by callers.

## What we are NOT changing

- Database, RLS, server functions, role lookup logic on the server.
- `/admin` and `/client` dashboards.
- Vendor signup, marketing content, branding.

## Result

- One URL to remember: `/login`.
- No double toasts, no "logged in then logged out" flash.
- Splash never blocks longer than 600ms.
- Button shows progress until the user is actually on their dashboard.
