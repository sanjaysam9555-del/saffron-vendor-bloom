## 1. Pulsing Saffron logo loader (replaces top progress bar)

**Problem:** `RouteProgress` keeps animating even after the page finishes loading because `useRouterState` reads `s.isLoading || s.status === "pending"`. The `status === "pending"` flag is hardly ever cleared in this app (no `loader` defined on routes), so the bar never fully turns off.

**Fix:**
- Upload the provided logo to `src/assets/saffron-events-loader.png` (using the user's attached `final_logo-2.png`).
- Rewrite `src/components/RouteProgress.tsx` as `<RouteLoader />`:
  - Show a small floating **pulsing logo** (~64px) centered top of screen.
  - Drive visibility off `useRouterState({ select: s => s.isLoading })` only — don't include `status === "pending"` (which is sticky).
  - Add a 120 ms debounce so the loader doesn't blink for instant transitions.
  - Add a 6 s safety timeout to force-hide it even if router state stalls.
  - Use a CSS `@keyframes saffron-pulse` (scale 0.92→1, opacity 0.6→1) defined in `src/styles.css`.

## 2. Stop login-screen flash on iOS PWA cold boot

**Problem:** `RootIndex` (`src/routes/index.tsx`) always renders `<ClientLoginForm />`, then `RedirectingLogin` waits for auth + a delay, then navigates to `/admin`. So an already-signed-in admin sees the login screen for ~half a second on every PWA launch.

**Fix in `src/routes/index.tsx`:**
- Inside the `ClientOnly` block, while `auth.initialized === false` OR (we have a session but role hasn't loaded), return a full-screen branded splash that simply shows the **same pulsing Saffron logo** on a `var(--cream)` background — not the login form.
- Once initialized:
  - If `session && (role === "admin" || role === "employee")` → `navigate({ to: "/admin", replace: true })` immediately (no `SIGN_IN_SUCCESS_HOLD_MS` delay on cold boot — only after a fresh sign-in).
  - If `session && role === "client"` → `navigate({ to: "/client", replace: true })` immediately.
  - Else render `<ClientLoginForm embedded />`.
- Use the existing `saffron.access.cache.v1` localStorage cache to know the role on the very first paint (already implemented in `auth.tsx`) — so the redirect can fire before the network round-trip completes.

This eliminates the login-form flash entirely for returning admins.

## 3. "Saffron Team" rating alongside Google rating

**DB migration** (new column on `vendors`):
```sql
ALTER TABLE public.vendors
  ADD COLUMN saffron_rating numeric(2,1)
  CHECK (saffron_rating IS NULL OR (saffron_rating >= 0 AND saffron_rating <= 5));
```

**Type update:** `src/lib/vendor-types.ts` — add `saffron_rating: number | null` to `Vendor`.

**Form (`VendorForm.tsx`):** add a "Saffron Team Rating (0–5)" input next to Google Rating, admin-editable.

**Card (`VendorCard.tsx`):** show a second pill next to the Google rating pill — visually distinct:
- Google pill (existing): amber background, `Star` icon.
- Saffron pill (new): terracotta background (`bg-[var(--terracotta-soft)]`, `text-[var(--terracotta)]`), `Sparkles` icon, label `"S"` prefix to be unmistakable, e.g. `✦ 4.5`.

**Detail (`VendorDetail.tsx`):** under the Google rating line, add a matching "Saffron Team rating" line with the same distinctive terracotta styling and Sparkles icon.

**Client-facing card/detail:** unchanged for now (Saffron rating is internal-only) — confirm with user if they want it visible to clients.

## 4. Mobile vendor TopNav layout

**Problem:** Currently on mobile (under "Vendor Studio" sub-label), only the `+` button shows on the right; Submissions is hidden (`hidden ... sm:inline-flex`). User wants on mobile, in the top row:
- `+` (Add Vendor) button moved to the **left** of the cluster
- **Submissions** button visible in the middle
- **UserMenu** on the right
- Equal spacing between them

**Fix in `src/components/vendor/TopNav.tsx`:**
- Restructure the header so on mobile (`< sm`):
  - Row 1: Logo + title (left), then a right cluster `[+] [Submissions] [UserMenu]` distributed with `gap` and `justify-between` inside its own flex container that takes available space.
  - Reorder DOM: put the `+` button first in the cluster (it currently sits between Submissions and UserMenu), make Submissions visible on mobile (remove the `hidden ... sm:inline-flex` — keep label short, maybe icon + text "Inbox" or just "Submissions" depending on width).
  - On `sm+`, keep the existing order/sizing (logo, search, stats, Submissions, +, UserMenu).
- Use `flex-1 justify-between` on the mobile cluster so the three buttons sit at left/center/right of the available width.

## Technical Summary

Files touched:
- `src/components/RouteProgress.tsx` — replace bar with debounced pulsing logo
- `src/styles.css` — add `@keyframes saffron-pulse`
- `src/assets/saffron-events-loader.png` — new (from upload)
- `src/routes/index.tsx` — splash + immediate redirect on cold boot
- `src/lib/vendor-types.ts` — `saffron_rating`
- `src/components/vendor/VendorForm.tsx` — input field
- `src/components/vendor/VendorCard.tsx` — distinctive Saffron pill
- `src/components/vendor/VendorDetail.tsx` — Saffron rating line
- `src/server/vendors.functions.ts` — include `saffron_rating` in select/insert/update payloads
- `src/components/vendor/TopNav.tsx` — mobile layout reorder
- DB migration adding `vendors.saffron_rating`

No auth or RLS changes required.
