Mobile-focused fixes for `src/routes/admin.projects.$id.tsx` and `src/components/timeline/VendorTimeline.tsx`. Desktop layout stays intact.

## 1. Booking Timeline section spacing

Right now `VendorTimeline`'s root wrapper carries leftover utility classes from a prior edit:
`"text-xs text-[var(--charcoal)]/55 my-[10px] text-center"` — this shrinks/center-aligns the whole timeline and gives it almost no top spacing from the section above.

Fix in `VendorTimeline.tsx`: replace that root wrapper className with proper section styling, e.g.
`"mt-8 sm:mt-10"` (plus restoring normal text color/size inheritance). This adds clear breathing room above "Booking Timeline" on mobile and stops the contents from being centered/tiny.

## 2. Client login table being clipped left & right on mobile

In `admin.projects.$id.tsx` line ~217 the wrapper is `-mx-4 sm:mx-0` which pulls the scroll container outside the page's `px-4` padding. On a 390px viewport the table edges sit flush to the screen and look cut off; the right edge especially gets clipped because of the inset scroll shadow + min-width 560px.

Fix: drop the negative margin on mobile so the scroller lives inside the page padding. Use `mx-0` on mobile (keep `sm:mx-0`), add `rounded-lg border border-[var(--border)]` at all sizes (currently only `sm:`), and keep `overflow-x-auto` so long emails still scroll horizontally inside the card instead of bleeding off-screen.

## 3. "Booking Timeline" heading colour — make it feel like a new section

In `VendorTimeline.tsx` the `<h2>` uses `text-[var(--charcoal)]`. Change it to the brand accent `text-[var(--terracotta)]` (same colour family already used for primary buttons / "Saffron's Pick"), and bump weight/size slightly on mobile (`text-2xl sm:text-xl`) so it reads as a clear section break rather than blending into the cream background.

The "Assigned vendors" heading will get the same treatment for visual parity (both become tab labels in step 4, so they should match).

## 4. Tabs: Assigned vendors (default) ↔ Booking Timeline

Replace the current vertical stack of `<VendorTimeline />` followed by `<AssignedVendorsSection />` (lines ~244–258) with a single tabbed container:

```text
┌─────────────────────────────────────┐
│  [ Assigned vendors ] [ Timeline ]  │  ← segmented control
├─────────────────────────────────────┤
│  <active panel>                     │
└─────────────────────────────────────┘
```

- Default active tab: **Assigned vendors**.
- Reuse the existing segmented-button styling pattern already used inside `VendorTimeline` (Timeline/Table toggle) and `AssignedVendorsSection` (List/Grouped toggle) so it feels native.
- Tabs render full-width on mobile (`w-full`), inline on `sm:`+.
- Only the active panel is mounted to keep DOM light and prevent the inactive section's local state (sub-view, edit modals) from staying alive in the background.
- Tab labels show a small icon + text: `Users` for Assigned vendors, `CalendarDays` for Booking Timeline.

Inside the new tab strip, the existing inner toggles inside each section (Timeline/Table; List/Grouped) remain unchanged — only the outer page-level switching is new.

## Technical notes

- All changes are JSX + Tailwind class edits in two files: `src/routes/admin.projects.$id.tsx` and `src/components/timeline/VendorTimeline.tsx`.
- No data, server functions, RLS, or routing changes.
- New local state: `const [section, setSection] = useState<"vendors" | "timeline">("vendors")` in the admin project route.
- Desktop (`sm:`+) preserves current spacing and uses the same tabs (single source of truth — simpler than branching layouts).

## Out of scope

- Client-side route page (`/client.*`), vendor list cards internal layout, quotes panel, comments modal.
- Any backend, auth, or schema changes.
- Desktop redesign beyond inheriting the new tab control.
