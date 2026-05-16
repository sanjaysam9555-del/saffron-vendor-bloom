# Timeline UI polish + perf fixes

Three targeted fixes — pure presentation + cache work, no schema or server changes.

## 1. Redesign the client urgency strip

File: `src/components/timeline/UrgencyStrip.tsx`

Current look is a flat amber utility strip that clashes with the Saffron brand palette (cream / terracotta / charcoal). New design:

- Brand-aligned container: subtle gradient from `var(--cream-deep)` to `var(--cream)`, hairline bottom border in `var(--champagne)`, soft inner shadow. Drops the amber background entirely.
- Left side: small pulsing dot in `var(--urgency-overdue)` when any item is overdue, otherwise `var(--urgency-urgent)`. Replace the warning triangle with an `AlarmClock` icon in `var(--terracotta)`. Label text uses `font-display` for a more editorial feel: "Needs your attention" + count badge (e.g. "3").
- Chips: pill cards with white background, 1px border tinted from the bucket color (mix at ~40% opacity), small bucket dot, category in `font-medium`, bucket label in `text-[var(--charcoal)]/55`, and a right-aligned days-left chip in the bucket color. Hover lifts with `translate-y-[-1px]` and shadow. Overdue chips get a faint pulsing ring.
- Layout: horizontal scroll on mobile keeps current behavior, but adds soft fade masks on left/right edges so cutoff chips read intentionally. Increases vertical padding from `py-1.5` to `py-2.5` for breathing room.
- Adds an inline "View all" link on the right that triggers `onChipClick` with a special sentinel (or new `onViewAll` prop) to open the Timeline tab without scrolling to a specific row.

No behavior change beyond the optional View-all affordance.

## 2. Fit all view-toggle buttons on mobile

File: `src/routes/client.index.tsx` (lines ~211–280)

Issue: at 360–414px width the Filters button + 4-tab toggle overflow and clip Timeline on the left.

Fix:
- Filters button: drop the "Filters" label on screens `<sm`, keep only the icon. Use `<span className="hidden sm:inline">Filters</span>`. Shrink to a square icon button (`h-8 w-8`) on mobile.
- View toggle: hide the label text on `<sm` for all 4 buttons (Grid / Board / Table / Timeline), keep icons. Reduce horizontal padding from `px-3` to `px-2` on mobile.
- Wrap the toggle group in `min-w-0` and the outer container in `flex-nowrap` (instead of `flex-wrap`) so it sits on one row even with the title; the title gets `truncate min-w-0`.
- Add `aria-label` to each tab button so icon-only mode is still accessible.

## 3. Make admin deadline save feel instant

File: `src/components/timeline/VendorTimeline.tsx` (DeadlineEditor, lines ~253–355)

Current flow waits for: server roundtrip → success → invalidate `["project-deadlines", projectId]` → refetch deadlines → realtime echo also fires same invalidation. Net latency 400ms–1.5s before the row updates.

Fix:
- Use React Query optimistic update on `saveM` and `clearM` via `onMutate`:
  - Snapshot current `["project-deadlines", projectId]` cache.
  - Synchronously upsert the edited category into the cache (mirror the `CategoryDeadline` shape).
  - Call `onDone()` immediately so the editor closes the moment the user clicks Save.
  - On `onError`, roll back to the snapshot and surface the existing toast.
  - On `onSettled`, invalidate the same key so the eventual server truth replaces our optimistic value (realtime echo becomes a cheap no-op).
- Also remove the implicit `Optimistic = true` behavior on `clearM` similarly (remove row from cache).

Result: row reflects new date / criticality and re-buckets in <16ms; server confirmation is silent.

## Out of scope

- Notifications when an item tips into Urgent / Overdue.
- Any schema, RLS, or server-function change.
- Admin-side timeline restyle (only the client strip is being redesigned now).
