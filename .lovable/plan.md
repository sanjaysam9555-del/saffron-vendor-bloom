# Standard branded loading screen

Right now every loading state is hand-rolled and inconsistent: "Loading your dashboard…" (admin gate), "Loading your portal…" (client gate), "Loading dashboard…" with a sparkle icon, "Loading your vendors…", plus assorted grey pulse blocks. This replaces them with one branded loader used everywhere.

## The new loader

A calm, Saffron-branded panel centred on the cream background:

- Small uppercase letterspaced eyebrow: "Saffron Planning Studio" in terracotta — same typographic voice as the app splash screen.
- A marigold-inspired mark: three concentric terracotta rings that breathe/rotate softly (petal spinner), not a generic spinner circle.
- One line of context text that each screen passes in ("Loading your dashboard", "Loading your vendors", "Loading your portal"), in charcoal at 60% opacity.
- A thin terracotta rule and a slow shimmer bar underneath to signal progress without a fake percentage.
- Respects reduced-motion: animation collapses to a static mark plus the text.

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
