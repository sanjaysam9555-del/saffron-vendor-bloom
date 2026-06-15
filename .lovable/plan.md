## Scope
Global polish (1–5) + Wow moments (23–25). Warm & lively energy. Respect `prefers-reduced-motion`.

## Libraries
- **`motion`** (the new lightweight successor to framer-motion by the same team — `motion/react`). Smaller bundle, hardware-accelerated, springs out of the box.
- **`canvas-confetti`** (~3kb) for booking celebration.
- Everything else uses Tailwind keyframes already in `src/styles.css`.

Both install via `bun add motion canvas-confetti`.

## Foundation

**`src/hooks/use-reduced-motion.ts`** — wrap `window.matchMedia('(prefers-reduced-motion: reduce)')`, returns boolean, SSR-safe.

**`src/lib/motion-presets.ts`** — single source of truth so every animation feels consistent:
- `fadeUp` (opacity 0→1, y 8→0, spring stiffness 240 damping 24)
- `scaleIn` (opacity 0→1, scale 0.96→1)
- `stagger` (parent: staggerChildren 0.05)
- `springSoft` (stiffness 180 damping 22)
When reduced-motion is on, presets collapse to opacity-only with 0.15s duration.

**`src/styles.css`** — add two keyframes: `number-flip` and `pulse-soft` (used by heart + countdown).

## 1. Route transitions
Wrap `<Outlet />` inside `src/routes/__root.tsx` content with `AnimatePresence mode="wait"` and a `motion.div` keyed by `location.pathname`, using `fadeUp` preset (180ms).

## 2. Page-load reveal
In top-level page shells (`admin.index.tsx`, `admin.projects.index.tsx`, `admin.projects.$id.index.tsx`, `client.index.tsx`):
wrap the main sections (hero / stats / grid) in a `motion.div` parent with `stagger` so they fade-up in sequence on mount. ~50ms stagger, runs once.

## 3. Toast tightening
`src/components/ui/sonner.tsx` — pass `toastOptions` className adding `data-[mounted]:animate-scale-in` and tighter exit. No layout/API change.

## 4. Skeleton → content crossfade
Generic helper `<Crossfade isLoading skeleton={<...}>{children}</Crossfade>` using `AnimatePresence`. Adopted in:
- vendor grid (`ClientVendorGrid`)
- project list (`admin.projects.index.tsx`)
- project detail header
Other usages can adopt later.

## 5. Button press feedback
`src/components/ui/button.tsx` — add `active:scale-[0.97] transition-transform duration-150` to base variants. Hover transitions tightened to 200ms ease-out. Variant API unchanged.

## 23. Booking celebration
Hook into `useSetVendorStatus` success path: when new status === `booked`, fire `canvas-confetti` (terracotta + gold palette, 60 pieces, 0.6s) and a one-off `Heart` burst overlay on the triggering element. Respects reduced-motion (skips burst, plays no confetti).

## 24. Wedding countdown flip
`RibbonHeader` already shows "X days to wedding". Replace the number with a `<FlipNumber value={days} />` component using `motion`'s `animate` on a numeric `MotionValue` so digits roll smoothly when the value changes (or on mount). Adds the same heart pulse (already added) — no other layout change.

## 25. Scroll reveals
Build a small `<Reveal>` wrapper (`motion.div` + `whileInView` once, `fadeUp` preset). Apply to:
- client portal hero + summary stats
- admin dashboard sections
Threshold 0.15. Disabled under reduced-motion.

## Reduced motion
- `use-reduced-motion` consumed by `motion-presets`, `Reveal`, `FlipNumber`, and the booking celebration.
- Confetti and Ken-Burns–style continuous motion are skipped entirely.
- Heart pulse and route transitions degrade to opacity-only.

## Files touched
- new: `src/hooks/use-reduced-motion.ts`, `src/lib/motion-presets.ts`, `src/components/motion/Crossfade.tsx`, `src/components/motion/Reveal.tsx`, `src/components/motion/FlipNumber.tsx`, `src/lib/celebrate.ts`
- edited: `src/routes/__root.tsx`, `src/components/ui/button.tsx`, `src/components/ui/sonner.tsx`, `src/styles.css`, `src/hooks/useSetVendorStatus.ts`, `src/components/timeline/VendorTimeline.tsx` (RibbonHeader only), `src/routes/admin.index.tsx`, `src/routes/admin.projects.index.tsx`, `src/routes/admin.projects.$id.index.tsx`, `src/routes/client.index.tsx`

## Out of scope (for later batches)
Admin-specific polish (6–13), client-specific polish (14–22). I'll queue those as a follow-up once this lands and feels right.
