## Goals

Address five UX issues across the app: button feedback, perceived navigation speed, iOS PWA session loss, iOS zoom-on-open, and auto-capitalization of entries.

---

## 1. Click feedback (instant tactile response)

**Files:** `src/components/ui/button.tsx`, `src/styles.css`

- Add `active:scale-[0.97] active:opacity-90 transition-transform` to the base button variants so every click produces an immediate visual response (no waiting on network / route).
- Add a global `:active` style on `<a>`, `<button>` and `[role="button"]` in `styles.css` for the same effect on non-shadcn buttons.
- Add `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` globally to remove the iOS 300 ms tap delay and grey overlay.
- For nav `<Link>` clicks specifically, wrap the destination card/button so it shows a faint pressed state while the route loads.

## 2. Page load feels laggy

Two causes: (a) every route waits on auth + server functions before painting, (b) no preloading.

**Files:** `src/router.tsx`, route loaders, `src/components/AuthGate.tsx` (top-level loading screens)

- Set `defaultPreload: "intent"` and `defaultPreloadDelay: 50` on the router so hovering/touching a `<Link>` starts the data fetch before the click.
- Add a small `<RouteTransition />` indicator (uses `useRouterState` `isLoading`) anchored to the top of screen — a 2 px progress bar — so the click always shows *something* immediately.
- Audit `AuthGate` / `ClientGate`: today they render a blank spinner whenever `loading` is true. Switch to rendering the previous page content while a background re-check happens (only show a full-screen spinner on the very first load when `!initialized`).
- Mark heavier admin loaders (`admin.projects.index`, `admin.submissions`) with React Query `placeholderData: keepPreviousData` so re-navigating shows cached results instantly.

## 3. iPhone web app logs out as admin every time

The earlier IndexedDB fix restores the *Supabase* session, but the *role* is fetched via a server function call on every cold boot, and `AuthGate` redirects to `/login` while `loading` is true on iOS where the cold-boot server call sometimes times out (6 s timeout in `auth.tsx`).

**Files:** `src/lib/auth.tsx`, `src/components/AuthGate.tsx`

- Cache the resolved `{ role, displayName }` for the current `user.id` in `localStorage` (and IndexedDB via the same durable adapter) keyed by user id.
- On boot, hydrate `role` synchronously from this cache **before** the server call returns so admin pages render immediately and survive a failed/slow `getCurrentUserAccess`.
- Re-fetch in the background and update if changed; only clear the cache on `signOut` or when the cached user id no longer matches.
- Make `AuthGate` treat "have session + cached role" as authenticated even while `loading` is true, instead of redirecting to `/login`.
- Add `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style` meta tags so the home-screen app behaves like a true PWA (better storage retention).

## 4. iPhone home-screen app opens zoomed

The viewport meta currently lacks `viewport-fit=cover` and `maximum-scale`. iOS standalone mode often inherits a zoomed state and any input <16 px also triggers auto-zoom on focus.

**Files:** `src/routes/__root.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx`

- Update viewport meta to: `width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover`.
- Add `apple-mobile-web-app-capable=yes` meta.
- Ensure all text inputs use **at least 16 px** font size on mobile (current `Input` already uses `text-base` then shrinks to `md:text-sm` — keep that). Audit `Textarea` and any custom search inputs to match. This prevents the focus-zoom that the user is then manually undoing.

## 5. Auto-capitalize first letter of every entry

Apply across all free-text inputs (vendor name, project, notes, search-style fields stay as-is for search; emails/passwords/URLs excluded).

**Files:** `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`

- Set default HTML attributes `autoCapitalize="sentences"` and `spellCheck` defaults on `Input`/`Textarea` (with overrides allowed) — this triggers the OS keyboard to capitalize the first letter on iOS/Android.
- For desktop browsers (where `autoCapitalize` does nothing), add a tiny helper applied **on blur** in `Input`: if `type` is `text`/`search` is *not* set, and value is non-empty, uppercase the first character. Implement via an `onBlur` wrapper that calls the original `onBlur` then dispatches a synthetic change with the capitalized value, so React Hook Form / controlled state updates correctly.
- Skip when `type` is one of: `email`, `password`, `url`, `tel`, `number`, `search`, or when `data-no-capitalize` attribute is present (escape hatch for things like usernames).

---

## Technical notes

- No new dependencies required.
- Auth role caching uses the existing `createDurableStorage()` pattern from `src/integrations/supabase/client.ts` (extracted into a small reusable helper or inlined in `auth.tsx`).
- Capitalization logic is opt-out (via `data-no-capitalize` or excluded `type`s) so existing forms keep working without per-field changes.
- Preload + transition bar is the biggest perceived-speed win — most navigations will feel instant once data starts fetching on hover/touchstart.

## Files touched

- `src/router.tsx`
- `src/routes/__root.tsx`
- `src/lib/auth.tsx`
- `src/components/AuthGate.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/styles.css`
- New: `src/components/RouteProgress.tsx`
