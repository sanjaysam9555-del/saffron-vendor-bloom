# Standard loading screen

Right now every loading state is hand-rolled and inconsistent: "Loading your dashboard…" (admin gate), "Loading your portal…" (client gate), "Loading dashboard…" with a sparkle icon, "Loading your vendors…", plus assorted grey pulse blocks. This replaces them with one clean, generic loader used everywhere. No brand name, no logo, no icon.

## The new loader

A quiet, centred composition on the cream background — pure geometry and type:

```text
        ────────────────────────
          ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
             (soft arc)

          Loading your dashboard
        ──────────────────────────
```

- A single thin terracotta arc on a faint ring, rotating slowly and smoothly (1.4s, ease-in-out) — minimal, no chunky spinner.
- Below it, one line of context text each screen passes in ("Loading your dashboard", "Loading your vendors"), small, charcoal at ~55% opacity, gentle letterspacing.
- Beneath the text, a 120px hairline track with a terracotta sliver sweeping across it — implies progress without a fake percentage.
- Everything fades in after ~200ms so fast loads never flash a loader.
- Reduced motion: arc and sweep freeze into a static ring and full-width hairline; text stays.


Two sizes from the same component:
- `fullscreen` — min-h-screen cream backdrop, used by auth gates and full-page route loads.
- `inline` — compact centred block, used inside a card/panel/tab that is loading while the page chrome is already visible.

Skeleton placeholders (vendor cards, project cards, notification rows, user rows) stay as skeletons, but move to one shared token so their pulse colour and radius match everywhere.

## Where it gets applied

Fullscreen loader:
- Admin auth gate and client portal gate
- Admin dashboard, client portal home, admin client-preview route

Inline loader / shared skeleton:
- Vendors list, projects list, submissions, users, notifications feed, calendar, project tabs (analytics, quotes, tasks, guests)

## Technical notes

- New `src/components/ui/LoadingState.tsx` exporting `<LoadingState variant="fullscreen" | "inline" label="…" />` and `<SkeletonBlock />`.
- Keyframes added to `src/styles.css` as design tokens (no inline `<style>` tags), gated behind the existing reduced-motion handling.
- Colours use the existing `--cream`, `--terracotta`, `--charcoal`, `--border` tokens only.
- Replaces `InlineLoader` in `AuthGate.tsx` / `ClientGate.tsx` and the ad-hoc loading blocks in the routes listed above; no data-fetching or business logic changes.
