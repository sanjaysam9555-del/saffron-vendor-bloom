# Mobile-optimised Admin Dashboard

Rework the Dashboard page so it reads well on a phone. Presentation only — no data, permissions, or calculation changes. Desktop layout stays as it is today.

## What's wrong now

- Stat cards are a horizontal scroll strip of narrow 128px boxes, so most numbers are off-screen and it isn't obvious you can swipe.
- Upcoming weddings sit two-per-row on a 393px screen, squeezing couple names and date into a very tight card.
- Deadlines and Recent Activity are dense desktop rows (fixed badge column + right-aligned meta) that crowd on narrow widths, and each list can scroll up to 540px inside the page, creating a scroll-within-scroll.
- Per-project P&L is an 8-column table with a 900px minimum width, so on mobile it is a sideways-scrolling table with all money columns hidden.
- Big fixed vertical gaps (`mt-10`) between every section waste screen height.

## What changes

**Stat cards** — replace the swipe strip with a 2-column grid on mobile (the "Active weddings" card spans the full width as a hero stat). Compact padding, smaller number size, label under the value. No hidden content.

**Upcoming weddings** — single column on mobile: each wedding becomes a full-width row with couple name, date, vendor count, and the days-to-go pill on the right. Two-up returns at `sm:`, four-up at `lg:`.

**Deadlines & Recent activity** — on mobile, drop the fixed-width badge column and stack: title line, then a small meta line (couple / time-ago) with the criticality chip inline. Remove the inner max-height so the page scrolls once instead of nesting scroll areas; cap the mobile list to the first 6 items with a "Show all" toggle.

**Per-project P&L** — on mobile, render as stacked cards instead of a table: couple name + wedding date as the header, then a 2-column key/value grid for Planning fee, Client billing, Vendor cost, Commission, Margin, Total income. The existing table stays for `lg:` and up.

**Vendor pipeline** — keep the bar, tighten card padding and switch the legend to a 2-column grid with smaller type on mobile.

**Spacing & heading** — reduce section gaps on mobile (`mt-6` scaling to `mt-10` at `sm:`), tighten section title size, and keep the existing hidden-on-mobile toolbar.

## Technical notes

- All work is in `src/routes/admin.dashboard.tsx` (`StatCards`, `UpcomingWeddings`, `UpcomingDeadlines`, `RecentActivity`, `PLTable`, `VendorPipeline`, `Section`/`SectionTitle`).
- Mobile-first Tailwind classes with `sm:`/`lg:` overrides restoring today's desktop rendering; existing CSS variables and card styles reused, no new tokens.
- Header rows use `grid-cols-[minmax(0,1fr)_auto]` with `min-w-0` on text and `shrink-0` on pills so long couple names truncate instead of clipping.
- The P&L card list and the table render from the same `plData` rows; only the presentation differs (`lg:hidden` / `hidden lg:block`).
- No changes to queries, server functions, or the admin-only visibility of financial figures.
