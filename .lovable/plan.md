## Goal

Replace the current bucket-stack Timeline (Overdue / Needs deadline / Booked stacked cards) on the Budget & Deadlines tab with a true date-anchored vertical ribbon, matching the selected "Chronological vertical ribbon" direction. Used by both admin (`/admin/projects/$id`) and client (`/client`).

## Scope

- Only the Timeline content inside `VendorTimeline.tsx`. Header, tabs, table view, and inline editor sheet stay untouched.
- Keep all existing data, edit behavior, and permissions. This is a presentation refactor.

## Layout

```text
┌─ Heading row ──────────────────────────────────────────────┐
│  Budget & Deadlines                Planned  Actual  Variance│
│  Wedding Day: Jul 7, 2026 — 32 days to go                  │
└────────────────────────────────────────────────────────────┘

       date side          ●          card side
   ┌─────────────┐        │        ┌──────────────┐
   │  OVERDUE    │        │        │ Anchors &    │
   │  Jun 6 2026 │────────●────────│ Emcees · HIGH│
   │  yesterday  │        │        │ Planned ₹30K │
   └─────────────┘        │        └──────────────┘
                          │
              ── To Be Scheduled ──
              ┌──────────┐  ┌──────────┐
              │ Content  │  │ DJs &    │
              │ Creators │  │ Live …   │
              └──────────┘  └──────────┘
                          │
   ┌──────────────┐       │       ┌─────────────┐
   │ Invites &    │───────●───────│ COMPLETED   │
   │ Stationery   │       │       │ May 20 2026 │
   │ Booked: …    │       │       └─────────────┘
                          │
                          ◆
                  The Wedding Day
                    Jul 7, 2026
```

- Central vertical spine on `md+`, single column on mobile.
- Each scheduled category = one row with the date/status label on one side and the detail card on the other, connected by a dot on the spine. Rows alternate sides chronologically.
- A "To Be Scheduled" band sits in date order at "today" (or just after overdue), holding all categories with `due_date = null` in a 2-col grid.
- "Wedding Day" rendered as a centered terminus marker at the bottom.
- Overall container width capped (max-w-5xl), generous vertical rhythm.

## Row variants

1. **Overdue** — terracotta dot, terracotta left border on card, "OVERDUE" pill, `"Was due X days ago"` label.
2. **Upcoming (scheduled, not booked)** — outlined terracotta dot, neutral card, `"In X days"` label, criticality pill (LOW/MEDIUM/HIGH).
3. **Booked** — sage dot, sage left border, faded card (`opacity-80` until hover), "BOOKED · {vendor name}" pill, shows Planned + Actual (+ MANUAL tag if applicable).
4. **Unscheduled** — lives inside the "To Be Scheduled" band, no spine dot, "Set a deadline" prompt + edit pencil.
5. **Wedding day terminus** — centered heart/diamond marker, display serif label.

Side alternation: index-based (even → date left / card right, odd → flipped) within each scheduled section. Unscheduled band spans full width.

## Sort & section order

1. Header summary (Planned, Actual, Variance — pulled from existing totals).
2. Overdue rows, ascending by due date.
3. Upcoming rows (not booked, not overdue), ascending by due date — months interleaved naturally; no per-month sub-header in v1.
4. "To Be Scheduled" band (unscheduled categories).
5. Booked rows, ascending by due date (or by booked date when no due date).
6. Wedding Day terminus.

## Files

- `src/components/timeline/VendorTimeline.tsx` — rewrite render. Keep existing data fetching, `buildTimelineItems` consumption, and the edit-sheet wiring.
- `src/components/timeline/build-timeline-items.ts` — add a `section: 'overdue' | 'upcoming' | 'unscheduled' | 'booked'` discriminator and `daysFromToday` helper so the renderer doesn't recompute. Keep existing bucket field for the Table view.
- `src/components/timeline/TimelineRow.tsx` (new) — single row component handling the three scheduled variants + side flip.
- `src/components/timeline/TimelineUnscheduled.tsx` (new) — the "To Be Scheduled" band.
- `src/components/timeline/TimelineWeddingMarker.tsx` (new) — terminus.
- `src/styles.css` — add semantic tokens if any are missing: `--timeline-spine`, `--status-overdue`, `--status-booked` (sage). Reuse existing terracotta/cream tokens; no raw hex in components.

No backend, route, or schema changes. No changes to the Table view, edit sheet, or `UrgencyStrip`.

## Interaction & accessibility

- Click anywhere on a row card → opens the same edit sheet currently used (admin) / read-only details (client).
- "Set a deadline" on unscheduled cards opens the same edit sheet pre-focused on the date field.
- Spine and dots are decorative (`aria-hidden`). Each row is a `<article>` with accessible heading + visible status pill so the order makes sense without color.
- Reduced-motion: stagger animation disabled.

## Motion (subtle, on mount only)

- Spine draws top-to-bottom (`scaleY 0 → 1`, 400ms).
- Dots fade/scale in with 60ms stagger.
- Wedding marker pulses once. No hover animation beyond the existing card shadow lift.

## Out of scope

- No new edit affordances, no new data fields, no permissions changes.
- Table view, urgency strip, vendor cards, and the wider project page are untouched.
- Month sub-headers, filtering, and zoom controls — deferred.
