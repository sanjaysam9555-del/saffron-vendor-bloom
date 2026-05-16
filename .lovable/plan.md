# Client Dashboard — Mobile Fixes

Three small mobile-only adjustments. Desktop layout unchanged.

## 1. Show "Saffron Planning Studio / Your Vendor Folio" on mobile

**File:** `src/components/client/ClientTopNav.tsx`

The brand text block is `hidden ... sm:block`, so on mobile only the logo shows. Remove the `hidden`, keep `leading-tight`, and tighten typography for small screens (smaller display name, narrower tracking on the subtitle) so it fits beside the logo without wrapping.

- Display name: `font-display text-sm sm:text-lg font-semibold text-[var(--terracotta)]`
- Subtitle: keep current `text-[9px] uppercase tracking-[0.22em]`

The search input is `order-last w-full` on mobile (drops to its own row), so the header row already has space for the text.

## 2. Welcome / subtitle / view controls in three rows on mobile

**File:** `src/routes/client.index.tsx` (the `mb-5 flex …` block around line ~180)

Currently a single flex row with title block on the left and the filter + view-mode toggles on the right. On mobile the subtitle truncates and the controls share the row, which the user wants split.

Change the outer wrapper to stack on mobile and stay horizontal on `sm+`:

- `flex flex-col items-start gap-3 sm:flex-row sm:flex-nowrap sm:items-end sm:justify-between sm:gap-3`
- Remove `truncate` from the subtitle `<p>` so the second line wraps naturally (or use `whitespace-normal`); keep `truncate` on the `<h1>`.
- The controls `<div>` becomes its own row: add `w-full sm:w-auto` and `justify-start` so the buttons sit on row 3 aligned left.

Result on mobile: Row 1 — "Welcome" (h1). Row 2 — "Here are the vendors…" subtitle (no truncation). Row 3 — Filters icon + view toggle.

## 3. "Needs your attention" strip in two rows on mobile

**File:** `src/components/timeline/UrgencyStrip.tsx`

Currently the label, chip rail, and "View all" share one horizontal row, so on a 390px viewport the chip rail is squeezed. Split into two rows on mobile:

- Outer container: `flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3`.
- Label group (alarm icon + "Needs your attention" + count badge): unchanged content, sits on row 1. Add a subtle continuous "buzz" to the alarm icon — wrap the `AlarmClock` in a span with a small custom keyframe (e.g. `animate-[buzz_1.2s_ease-in-out_infinite]` with a 2–3 degree rotate wobble) defined in `src/styles.css`. Keep the existing red `animate-ping` halo.
- Chip rail row stays as the existing horizontally scrollable `overflow-x-auto` flex; on mobile it spans full width (`w-full`) so all categories scroll right-to-left freely. Edge fades already present.
- "View all" stays `hidden sm:inline-flex` (no change on mobile).

### Buzz keyframe (add to `src/styles.css`)

```css
@keyframes buzz {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(8deg); }
}
```

## Out of scope

Desktop layout, sidebar, vendor cards, timeline view internals, backend, schema.
