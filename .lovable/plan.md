## Goal

When someone visits `planwithsaffron.in` (the root `/`), they should see the **client login form right there** — the URL must stay as `planwithsaffron.in`, with no redirect to `/client/login`.

Admins/employees continue to use `planwithsaffron.in/login` as today.

## Current behavior (the bug)

- `/` renders the vendor dashboard wrapped in `AuthGate`.
- `AuthGate` sees no session → redirects to `/client/login`.
- Result: URL changes to `/client/login` instead of staying at root.

## Changes

### 1. `src/routes/index.tsx` — make `/` smart based on auth state

Replace the current always-dashboard component with a small router-aware component:

- While auth is loading → show a centered "Loading…" splash.
- If no session → render the **client login form inline** (same UI as `/client/login`), so the URL stays `/`.
- If session exists and role is `client` → redirect to `/client` (their portal).
- If session exists and role is `admin` or `employee` → render the existing vendor `DashboardPage` (no AuthGate wrapper needed since we've already checked).

Update the route's `head()` meta so the homepage title reads as the client portal landing (e.g. "Saffron Events — Client Portal") instead of "Vendor Dashboard", since that's what unauthenticated visitors see.

### 2. Extract the client login form into a shared component

Create `src/components/client/ClientLoginForm.tsx` containing the existing form markup + `signIn` logic from `src/routes/client.login.tsx`. Both `/` (new) and `/client/login` (existing, kept for backwards compatibility / direct links) render this component so we don't duplicate the form.

### 3. `src/routes/client.login.tsx` — keep route, use shared component

Keep the route alive (so old links don't 404) but have it just render `<ClientLoginForm />`. Behavior unchanged for users who land here directly.

### 4. `src/components/AuthGate.tsx` — redirect target for protected pages

For other admin/employee-protected pages (e.g. `/admin/...`), unauthenticated access should still bounce somewhere sensible. Change the redirect target from `/client/login` back to `/` (the new public landing). That keeps the rule consistent: root is the public entry, and `/login` remains the staff entry.

### 5. `src/components/ClientGate.tsx` — same update

Change unauthenticated redirect from `/client/login` to `/` for consistency.

## Files touched

- `src/routes/index.tsx` — auth-aware root: shows client login when logged out, dashboard when admin/employee, redirects clients to `/client`.
- `src/components/client/ClientLoginForm.tsx` — new shared form component.
- `src/routes/client.login.tsx` — render shared `ClientLoginForm`.
- `src/components/AuthGate.tsx` — redirect to `/` instead of `/client/login`.
- `src/components/ClientGate.tsx` — redirect to `/` instead of `/client/login`.

## Result

- `planwithsaffron.in` → shows client login form, URL stays at root.
- `planwithsaffron.in/login` → admin / employee login (unchanged).
- `planwithsaffron.in/client/login` → still works, shows same client form.
- Logged-in clients hitting `/` → sent to `/client`.
- Logged-in admins/employees hitting `/` → see the vendor dashboard.