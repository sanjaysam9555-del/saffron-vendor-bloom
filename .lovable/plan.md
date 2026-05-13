## Add a branded splash screen on app open

When returning users open the PWA / mobile web app, the screen is briefly black before the dashboard renders. Replace that with a branded splash plate.

### What the user sees

A full-screen plate in brand tones (cream background, terracotta + charcoal text, Cormorant Garamond display font) showing:

- Heading: "Welcome to Saffron Planning Studio"
- Quote: "Extraordinary weddings don't just happen, they are planned."
- Subtle fade-in, then fade-out

Visible for up to 3 seconds, then dismissed. Also dismissed earlier if auth + first route are ready and at least a minimum (~1.2s) has elapsed, so it never feels stuck.

### Where it lives

1. New component `src/components/SplashScreen.tsx` — full-viewport overlay using existing CSS tokens (`--cream`, `--terracotta`, `--charcoal`, `--champagne`) and the Cormorant Garamond display font already loaded in `__root.tsx`. Uses `position: fixed; inset: 0; z-index: 9999` with a fade-out transition.

2. Mount inside `RootComponent` in `src/routes/__root.tsx`, above `<Outlet />`, so it covers the very first paint regardless of route (logged-in users land on `/client` or `/admin`, logged-out on `/`).

3. Show logic:
   - Show on every fresh app load (mount of root). This naturally covers the PWA "tap icon → launch" case, where the web app boots from scratch.
   - Hide when: `min 1.2s elapsed` AND `auth.initialized === true`, OR a hard cap of 3000ms — whichever comes first.
   - Use a small `useState(visible)` + `useEffect` with timers; consume `useAuth().initialized` to know when the app is ready.
   - Add a 250ms opacity fade-out so the handoff to the dashboard isn't abrupt.

4. Eliminate the black flash:
   - Set `<body>` background to `var(--cream)` in `src/styles.css` (currently relying on per-page backgrounds, which is why the gap renders black on mobile Safari/Chrome before React mounts).
   - Update `public/site.webmanifest` `background_color` to `#F5F0E8` (the cream tone) and `theme_color` to `#C96F4A` (terracotta) so the OS-level PWA splash that shows before JS loads also matches the brand instead of white/black.
   - Fill in `name` ("Saffron Planning Studio") and `short_name` ("Saffron") in the manifest while we're there.

### Out of scope

- No changes to auth flow, routing, or data loading.
- No new images/illustrations — pure type + color, matching the rest of the app.

### Technical notes

- Component is presentational only; no network calls.
- SSR-safe: timers run inside `useEffect`, initial `visible` state is `true` so SSR markup includes the splash and there is no flash of unsplashed content.
- Respects `prefers-reduced-motion` by skipping the fade animation (still uses the timer).
