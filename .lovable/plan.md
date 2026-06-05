# Animation Enhancement Plan

Goal: make admin and client UIs feel alive — page transitions, scroll reveals, list staggers, hover affordances — without hurting performance or bundle size. No heavy animation libraries. Use CSS, the Tailwind keyframes already in `tailwind.config.ts` (`animate-fade-in`, `animate-scale-in`, `animate-slide-in-right`, `hover-scale`, `story-link`), the native View Transitions API, and a single tiny IntersectionObserver hook for scroll reveals.

## Guiding rules

- **No `framer-motion`.** Not installed; would add ~40 KB gz. Existing CSS utilities are enough.
- **GPU-only properties** — animate `transform` and `opacity`. Never `width/height/top/left` on lists.
- **Respect `prefers-reduced-motion`** — one global rule in `src/styles.css` disables all non-essential motion.
- **Durations**: 150–250 ms micro-interactions, 300–450 ms page/section entrances. Nothing longer.
- **Stagger via CSS `animation-delay`** (`index * 40ms`, capped at 12 items) — no JS orchestration.
- **One-shot reveals** — once visible, stay visible. No re-trigger on scroll-up.

## 1. Page / route transitions

Two layers, both native:

**a. View Transitions API (cross-fade between routes)**
- Enable on the router: `defaultViewTransition: true` in `src/router.tsx`. TanStack Router wraps every navigation in `document.startViewTransition` where supported (Chromium, Safari TP). Silent no-op elsewhere. Zero bundle cost.
- Add minimal CSS in `src/styles.css`:
  ```css
  ::view-transition-old(root), ::view-transition-new(root) {
    animation-duration: 220ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  ```

**b. Per-route content entrance (fallback + extra polish)**
- Wrap each route's top-level container with `animate-fade-in` so even browsers without View Transitions get a soft entrance.
- Targets: `client.index.tsx`, `admin.index.tsx`, `admin.projects.index.tsx`, `admin.projects.$id.index.tsx`, `admin.projects.$id.preview.$clientId.tsx`, `admin.users.tsx`, `admin.submissions.tsx`, client vendor detail.

**c. Splash → app handoff**
- `SplashScreen.tsx` currently cuts. Add `animate-fade-out` (200 ms) on unmount and `animate-fade-in` on the app shell so there's no flash.

## 2. Scroll-driven reveal animations

Two complementary techniques — pick per surface:

**a. Native CSS scroll-driven animations (preferred where supported)**
- Add a `@utility` reveal class in `src/styles.css`:
  ```css
  @utility reveal-on-scroll {
    animation: fade-in linear both;
    animation-timeline: view();
    animation-range: entry 10% cover 30%;
  }
  ```
- Apply to section headers, hero blocks, marketing-style strips on the client dashboard. Zero JS, runs on the compositor.
- Falls back gracefully in non-supporting browsers (Firefox today): element just appears statically.

**b. IntersectionObserver hook (universal fallback for important reveals)**
- New `src/hooks/use-reveal-on-scroll.ts` — single shared observer, `rootMargin: "0px 0px -10% 0px"`, `threshold: 0.1`, unobserves after first hit. ~30 lines, no deps.
- Returns `ref` + `isVisible`; component adds `animate-fade-in` when true.
- Use on: vendor cards in `ClientVendorTable`, project cards in admin lists, quote panel rows, attachment grid items, timeline `UrgencyStrip` items.
- Stagger via inline `style={{ animationDelay: \`${Math.min(i, 12) * 40}ms\` }}` on first reveal.

Performance guard: ONE observer shared across all subscribers (singleton in the hook module), not one per element. Important for long lists.

## 3. List / grid mount staggers

For initial page load (before scroll observer kicks in for above-the-fold items):
- First 12 cards animate in with staggered delay.
- After that, rely on scroll reveal (§2) for below-the-fold rows.
- Gate with `isInitialMount` ref so re-renders (filtering, sorting) don't re-trigger animation.

## 4. Hover & micro-interactions

- `hover-scale` on: vendor cards, project cards, primary CTAs, sidebar nav rows.
- `story-link` underline on inline text links (vendor names → detail, project titles).
- Buttons: `transition-colors active:scale-[0.98]` — tactile, cheap.
- Sidebar active indicator: animate accent bar with `transition-transform duration-200`.

## 5. Dialogs, sheets, drawers, popovers

shadcn primitives already animate via `data-[state=open]` keyframes from `tailwindcss-animate`. Audit `dialog.tsx`, `sheet.tsx`, `drawer.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `hover-card.tsx`, `tooltip.tsx`; fill any missing `data-[state=open]:animate-in fade-in-0 zoom-in-95` / `slide-in-from-*` classes.

## 6. Data swap transitions

- Instagram preview strip, vendor detail panes, quote panels: when query resolves, fade content in via `key` change + `animate-fade-in`.
- Skeleton shimmer: keep current `animate-pulse`.
- Empty states (`EmptyState`): icon `animate-scale-in`, text `animate-fade-in`, one-shot.

## 7. Route progress bar

`RouteProgress.tsx` already exists. Verify it shows during View Transitions navigation; tune to fade out 150 ms after navigation completes so it doesn't double-flash with the route fade.

## Performance safeguards

- Global `prefers-reduced-motion` rule in `src/styles.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- `will-change: transform` only on persistently animating elements (sidebar hover items). Never blanket-apply.
- Single shared IntersectionObserver instance — not per-element.
- Stagger cap = 12 × 40 ms = 480 ms max.
- No animations on virtualized list items mid-scroll — only on first mount + on-enter reveal.
- View Transitions only between top-level routes, not on every search-param change (TanStack Router default behavior, but verify).

## Files touched

- `src/styles.css` — reduced-motion rule, view-transition timing, `reveal-on-scroll` utility, splash fade keyframes if missing.
- `src/router.tsx` — `defaultViewTransition: true`.
- `src/hooks/use-reveal-on-scroll.ts` — **new**, shared-observer hook.
- Route files in §1 — wrapper class on container.
- List components — `ClientVendorTable`, admin vendor grid, project cards, quote rows, attachment grid, urgency strip — add reveal hook + stagger delay.
- `EmptyState`, `Sidebar`, `ClientSidebar`, `RouteProgress`, `SplashScreen` — minor class additions.
- shadcn ui primitives in §5 — only if audit finds missing classes.

No new dependencies. No render-loop changes. Net bundle impact ≈ 0 KB (+ ~30 lines for the reveal hook).

## Out of scope

- `framer-motion`, `motion-one`, `auto-animate`, GSAP, Lottie.
- Parallax / sticky-pin / scroll-jacking effects.
- Redesigning components — this pass only adds motion.
