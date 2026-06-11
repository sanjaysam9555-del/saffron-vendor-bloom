## Client Dashboard: Informational Upgrades + Guided Tour

Two parts: (A) make the dashboard self-explanatory at a glance, and (B) add a "Tour" button in the header that launches a step-by-step guided walkthrough on demand.

---

### Part A — Make the dashboard more informational

1. **Header context strip (under `ClientTopNav`)**
   - Days-to-wedding chip (e.g., "142 days to go"), event location if present, and personalized greeting on mobile (currently desktop only).
   - Tiny progress meter: "X of Y categories booked" from existing `timelineItems` (`booked === true`).

2. **At-a-glance summary band (above Urgency Strip)** — 4 compact stat tiles (responsive 4-col → 2×2 on mobile):
   - **Total Vendors Shared**
   - **Shortlisted / Approved** (counts from `client_status`)
   - **Booked Categories** (`booked` true / total)
   - **Budget Snapshot** (sum of `actual_amount_override ?? closed_amount_auto`; hidden when no amounts)
   - Each tile clickable: jumps to relevant view (e.g., "Booked" → Overview, "Shortlisted" → Board).

3. **Section descriptions (dismissible inline subtitles)**
   - Overview: "Track booking deadlines and budgets per category."
   - Table: "All vendors in a sortable list — quickly compare and act."
   - Board: "Drag vendors across stages: Shared → Shortlisted → Approved → Rejected."
   - Vendor View: "Browse vendor cards with photos, links, and quick actions."
   - Dismiss state per-view in `localStorage`.

4. **Status legend popover** — small "?" pill near the view toggle explaining Shared / Shortlisted / Approved / Rejected.

5. **Footer help row** — "Need help? Contact your planner" with planner contact (single source of truth).

---

### Part B — Guided Tour (on-demand, never auto)

**Trigger:** "Take a tour" button in `ClientTopNav` (left of notifications). Icon `Compass`, label hidden on mobile. Clicking always restarts from step 1. `localStorage` only stores `tourLastCompletedAt` to render a subtle ✓ next to the button.

**Library:** `driver.js` (~5KB, CSS-selector based). `bun add driver.js`. Themed via `src/styles.css` `.saffron-tour` overrides (terracotta accents, cream bg, `font-display` titles, rounded-md).

**Steps** (each spotlights a `data-tour="..."` attribute added to existing components — no layout changes):

| # | Target | Title | Body |
|---|---|---|---|
| 1 | `header-greeting` | Welcome to your Vendor Folio | Intro + tour purpose |
| 2 | `summary-stats` | At-a-glance progress | Vendor counts, booking, budget |
| 3 | `urgency-strip` | Needs your attention | Time-sensitive chips → jump to category |
| 4 | `view-toggle` | Switch how you view vendors | 4 view modes |
| 5 | `view-toggle-timeline` | Overview | Budgets + deadlines per category |
| 6 | `view-toggle-table` | Table | Compare side-by-side |
| 7 | `view-toggle-board` | Board | Drag Shared → Shortlisted → Approved → Rejected |
| 8 | `view-toggle-grid` | Vendor View | Photo cards + Instagram previews |
| 9 | `filters-button` | Filters | Narrow by category/location |
| 10 | `search-input` | Search | Find by name, handle, location |
| 11 | `notifications-bell` | Notifications | Planner comments, quote updates |
| 12 | `vendor-card-first` | Vendor cards | Click to view details, quotes, comment to planner |
| 13 | `tour-button` | Re-take any time | Restart whenever |

Steps targeting elements not currently visible auto-switch the view first. Controls: Skip / Prev / Next / ESC. SR-only step counter ("Step 4 of 13"), focus trap.

---

### Files

**New**
- `src/hooks/useClientTour.ts` — builds steps, controls driver instance, switches views between steps.
- `src/components/client/ClientSummaryStats.tsx` — the 4 stat tiles.
- `src/components/client/ClientTourButton.tsx` — header button + completion tick.
- `src/components/client/SectionHelper.tsx` — dismissible per-view subtitle.

**Edited**
- `src/components/client/ClientTopNav.tsx` — Tour button + days-to-wedding chip + mobile greeting.
- `src/routes/client.index.tsx` — mount summary stats, status-legend popover, footer help row, section helpers, `data-tour` attributes.
- `src/components/timeline/VendorTimeline.tsx` (client mode only) — `data-tour="overview"` on header.
- `src/components/client/ClientSidebar.tsx` — `data-tour="filters-panel"`.
- `src/styles.css` — driver.js theme overrides.

**Deps:** `driver.js`. **No backend changes** — all data derives from existing queries.

---

### Out of scope (follow-ups)
- Standalone Help Center page with screenshots/video.
- In-app messaging with planner.
- Tour analytics persistence.