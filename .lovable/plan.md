## Problem

When switching between Vendors, Projects, and a few other admin/client pages on mobile, the new page renders dim for a moment and only brightens after the user taps. The user expects pages to appear fully bright immediately.

## Root cause

Two compounding things cause the dim flash:

1. **Page-level fade-up animations** — Top-level wrappers on these routes use `animate-fade-up` (600ms keyframe going `opacity: 0 → 1`). Across `admin.index.tsx`, `admin.projects.index.tsx`, `admin.submissions.tsx`, `client.index.tsx`, etc., the page header/content starts invisible and fades up every time the route mounts, which on mobile reads as the whole screen going dim.

2. **`useRevealOnScroll` on `ProjectCard`** — Each card starts with hardcoded `opacity-0` and only switches to `animate-fade-up` after the shared `IntersectionObserver` fires. On iOS Safari, after a same-origin route navigation, IO callbacks are commonly deferred until the next user gesture (tap/scroll). That's exactly the "becomes brighter after tap" behavior — the tap unblocks IO, the cards flip to visible.

`RouteFade` in `__root.tsx` also re-fades the whole `<Outlet />` whenever the first path segment changes (e.g. `/admin` → `/client`), adding another fade layer on top.

## Fix

Keep the polish on the *first* visit, but stop re-dimming on every navigation.

### 1. Make `useRevealOnScroll` mobile-safe

`src/hooks/use-reveal-on-scroll.ts`
- Default `isVisible` to `true` on touch / coarse-pointer devices, OR
- Schedule a `requestAnimationFrame` + `setTimeout(…, 50ms)` fallback that flips `isVisible` to `true` if IO hasn't fired yet (handles the iOS deferred-IO case).
- Keep existing reduced-motion and no-IO fast paths.

This removes the "stuck at opacity-0 until tap" failure mode without losing the scroll reveal on desktop.

### 2. Drop the route-level fade-up on pages that re-mount on every nav

Remove `animate-fade-up` from the *outer* container of:
- `src/routes/admin.index.tsx` (vendors pane header at line 214, empty state at 434)
- `src/routes/admin.projects.index.tsx` (header at line 171)
- `src/routes/admin.submissions.tsx` (header at line 72)
- `src/routes/client.index.tsx` (header at line 258, empty state at 500)

Inner content (cards, toasts, helper banners) can keep their fade — the dim feeling comes from the whole page wrapper starting at `opacity: 0`.

### 3. Soften `RouteFade` so it doesn't dim within a section

`src/routes/__root.tsx` `RouteFade`
- Either remove `RouteFade` entirely (rely on per-component reveals), or
- Change `fadeUp` initial state for route transitions to `opacity: 1` (no fade) and only animate the 4px slide. This kills the full-screen dim on cross-section nav (e.g. `/admin` → `/client`) while keeping a subtle motion cue.

We'll go with "remove `RouteFade`" since per-page reveals already provide motion and the wrapper is the main offender on mobile.

### What is NOT changed

- `SplashScreen` (first-load only, session-scoped — unrelated).
- `RouteProgress` top bar (not a dimming source).
- `ProjectCard` hover/transform transitions (purely interactive, not load-time).
- Per-card staggered reveal on desktop (still works via IO).

## Verification

1. On mobile viewport (375×812), navigate Vendors ↔ Projects ↔ Submissions repeatedly — page should appear at full brightness immediately, no visible fade.
2. Cards should be visible without a tap on iOS.
3. Desktop scroll-reveal on long project grids should still animate as cards enter the viewport.
4. First-time splash on cold load is unchanged.
