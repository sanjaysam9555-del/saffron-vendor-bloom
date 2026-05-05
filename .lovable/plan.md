## Goals

1. The branded loading screen should match the **dashboard** background (cream `--cream` = `#F5F0E8`) with logo + wordmark in **terracotta** (`--terracotta` = `#9F3822`) — the inverse of today's solid red.
2. Add a "Loading…" hint at the bottom of the splash so users know the page is loading.
3. Use this same splash everywhere a route or dashboard is loading (already centralized in `BrandSplash`).
4. iPhone PWA cold boot: instead of flashing the **login screen**, show an opening splash plate (logo + wordmark, **no "Loading…" text**) for ~1.5 seconds, then reveal whatever comes next (dashboard if signed in, login form if not).

## Changes

### `src/components/BrandSplash.tsx` — restyle + optional loading text

- Background: `bg-[var(--cream)]` (was solid terracotta).
- Logo: keep, same gentle 2s pulse.
- Wordmark "Saffron Planning Studio": colour `text-[var(--terracotta)]`.
- Subtitle "Wedding & Event Planning": `text-[var(--terracotta)]/70`.
- Add a new prop `showLoading?: boolean` (default `true`). When `true`, render a small uppercase `Loading…` line below the wordmark. When `false`, omit it (used for the PWA opening plate).

All current callers (`AuthGate`, `ClientGate`, `RouteProgress`, `client.index`, `index`) keep working unchanged — they all want the loading variant.

### `public/site.webmanifest` + `__root.tsx` theme-color

- Update `theme_color` and `background_color` from `#9F3822` to `#F5F0E8` so the iOS PWA splash chrome matches the new cream splash plate.
- Update the `meta name="theme-color"` in `src/routes/__root.tsx` to `#F5F0E8`.
- Change `apple-mobile-web-app-status-bar-style` to `default` (dark text on light bg) so the iOS status bar reads correctly over the cream plate.

### `src/routes/index.tsx` — opening splash plate before login/redirect

The root `/` route currently renders the login form immediately when there's no session, which is what the user sees on iPhone PWA cold boot.

Add a small client-only "opening plate" gate inside `RedirectingLogin`:

- On first mount, set `showOpeningPlate = true` and start a `setTimeout(..., 1500)` that flips it back to `false`.
- While `showOpeningPlate || !initialized` → render `<BrandSplash showLoading={false} />`.
- If a session exists, the existing `useEffect` redirects to `/admin` or `/client` — the splash naturally bridges that navigation.
- If no session and the timer has elapsed, render the embedded `ClientLoginForm` as today.

This gives every visitor (PWA cold boot, fresh tab, returning user) a brief brand plate first. Signed-in users see splash → dashboard with no login flash. Logged-out users see splash → login form.

### Verification

- Loading screens across the app now show cream background with terracotta logo and a "Loading…" caption (admin gate, client gate, route transitions, dashboard first-load).
- Opening the installed iPhone PWA shows the cream splash plate (no "Loading…" text) for ~1.5s, then either the dashboard (signed-in) or the login form (signed-out) — never a sudden login flash.
- iOS PWA status bar/icons render in dark colour over the cream splash plate (no white-on-cream invisible bar).
