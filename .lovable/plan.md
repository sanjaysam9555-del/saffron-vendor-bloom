## Client Dashboard Refinements

### 1. Header cleanup (`ClientTopNav.tsx`)
- Remove the search input from the header. Search is **moved into the filter sidebar** (`ClientSidebar.tsx`) as its top field, so name/handle/location search still works.
- Remove the days-to-go chip from the header (desktop pill + mobile chip) — moves into a new summary tile.
- Remove the desktop "Bride & Groom + date" block — moves into a new summary tile.
- Reorder header right-side controls: **Notifications bell (left) → Take a tour → Sign out (far right)**.
- Sign out becomes **icon-only on desktop too** (drop the "Sign out" label, keep tooltip + aria-label).

### 2. Search in sidebar (`ClientSidebar.tsx`)
- Add a search input at the top of the filter panel (label "Search vendors", same icon + placeholder as before).
- Wire to the existing `search` / `onSearchChange` state lifted in `client.index.tsx` (just rerouted from header to sidebar; no new state).
- Mobile: sidebar already opens as a sheet on demand, so the search lives there too.

### 3. Summary tiles → 6 tiles (`ClientSummaryStats.tsx`)
- Shrink padding/icon to fit 6 across: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`.
- Two new info tiles prepended (non-clickable, no hover lift):
  1. **Couple + Date** — "Bride & Groom" (font-display) + formatted wedding date.
  2. **Countdown** — "142 days to go" with `CalendarHeart` icon.
- Existing 4 tiles (Vendors Shared, Your Picks, Booked Categories, Spend So Far) keep behavior, smaller sizing.

### 4. Attention bar position (`client.index.tsx`)
- Order becomes: **Header → UrgencyStrip → Summary Tiles → View toggle → content**.

### 5. Remove Status Legend
- Delete the "Statuses" popover next to the view toggle.
- Remove the `status-legend` step from `useClientTour.ts`.

### 6. Tour button + bell reorder
- Covered in (1).

### 7. Fix filters-button highlight in tour (desktop)
- On desktop the filter trigger location differs from mobile. In `useClientTour.ts`, resolve the live element at runtime: prefer `[data-tour="filters-button"]`, fall back to `[data-tour="filters-panel"]` or the sidebar root if the button isn't in the DOM. Ensures the spotlight lands on a real element on both breakpoints.
- Also verify `data-tour="filters-button"` is attached to a stable, always-rendered element (move it onto the desktop filter toggle if needed).

### 8. Tour card typography (`src/styles.css`)
- Update `.driver-popover.saffron-tour`:
  - Title → `font-family: var(--font-display)` (brand display font used elsewhere).
  - Body, buttons, progress text → brand body font.

### 9. Add Overview sub-explainers
- Keep the existing 4 view-toggle steps. Add **two new steps** when on Overview:
  - **Timeline column** — explains deadlines / booked toggle / budget chips. Target a new `data-tour="overview-timeline-row"` on the first row in `VendorTimeline`.
  - **Per-category vendor table** — explains the expanded vendor list inside Overview. Target a new `data-tour="overview-vendor-table"` (auto-expand the first category if collapsed).
- Both steps use `onHighlightStarted: ensureView("timeline")`.

### Files
**Edited**
- `src/components/client/ClientTopNav.tsx` — strip search/date/countdown; reorder; icon-only sign out.
- `src/components/client/ClientSidebar.tsx` — add search input at top, wired to lifted state.
- `src/components/client/ClientSummaryStats.tsx` — 6-tile grid + 2 new info tiles.
- `src/routes/client.index.tsx` — reorder UrgencyStrip above tiles; drop status-legend popover; pass couple/date/countdown to summary stats; route `search`/`onSearchChange` to sidebar instead of header.
- `src/components/timeline/VendorTimeline.tsx` — add `data-tour` hooks for overview sub-steps.
- `src/hooks/useClientTour.ts` — remove status-legend step; add 2 overview sub-steps; resilient filters target.
- `src/styles.css` — brand fonts on `.saffron-tour`.

**No new files. No backend changes.**
