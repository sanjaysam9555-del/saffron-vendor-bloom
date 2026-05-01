# Mobile Optimization for Vendor Dashboards (Admin & Client)

The All-Vendors dashboard works well on desktop but breaks down on phones because:

- The 64px filter sidebar is always visible, eating screen width.
- The top nav crams logo + search + stats + buttons into one row.
- Main content uses `px-6 py-5` even on small screens, leaving too little room for cards.
- The dashboard header (title + view toggle) wraps awkwardly.
- Card grid drops to 1 column but with desktop-sized gaps.

This plan fixes both `/admin` and `/client` with a consistent mobile pattern.

## Changes

### 1. Filter sidebars become a slide-over drawer on mobile
Files: `src/components/vendor/Sidebar.tsx`, `src/components/client/ClientSidebar.tsx`

- Hide the inline sidebar on `<lg` (`hidden lg:block`).
- Add an overlay drawer (slides in from the left, ~85% width, scrim behind) that mounts only when `mobileOpen` is true.
- Reuse the existing category/location markup inside the drawer (extract to a small inner block to avoid duplication).
- Drawer has its own close (X) button and "Clear" link.

### 2. Add a "Filters" trigger on the dashboard header (mobile only)
Files: `src/routes/admin.index.tsx`, `src/routes/client.index.tsx`

- New `mobileFiltersOpen` state in each route.
- Show a `Filters` button (with funnel icon and a small dot when filters are active) next to the view toggle, visible only on `<lg`.
- Pass `mobileOpen` / `onMobileClose` props into the sidebar.

### 3. Tighten TopNavs for narrow screens
Files: `src/components/vendor/TopNav.tsx`, `src/components/client/ClientTopNav.tsx`

- Reduce horizontal gap from `gap-4` to `gap-2 sm:gap-4`.
- Drop the search `max-w-[280px]` cap on mobile so it stretches across the row (`max-w-none sm:max-w-[280px]`).
- Logo: drop the textual block on mobile (already hidden), keep just the mark.
- Admin: keep the "+" Add Vendor button icon-only on mobile (already does); keep UserMenu compact.
- Client: stack name/date below the header on mobile via `hidden md:block` (already does) — leave as-is.

### 4. Tighten main content padding + grid on mobile
Files: `src/routes/admin.index.tsx`, `src/routes/client.index.tsx`

- `main` padding: `px-3 py-4 sm:px-6 sm:py-5 lg:px-8`.
- Card grid gap: `gap-3 sm:gap-4`.
- Dashboard header (title row + view toggle): allow it to wrap cleanly with `flex-wrap` and shrink the title to `text-xl sm:text-2xl`.

### 5. Bulk-edit affordances stay desktop-only
- Hide the "Bulk Edit" toggle button on `<sm` (it's a power-user action and the BulkActionBar doesn't fit on phones anyway). Existing `BulkActionBar` already sticks to bottom — leave its layout, but make sure it wraps on small screens.

## Files touched
- `src/components/vendor/Sidebar.tsx` — add overlay drawer mode
- `src/components/client/ClientSidebar.tsx` — add overlay drawer mode
- `src/components/vendor/TopNav.tsx` — tighter mobile spacing
- `src/components/client/ClientTopNav.tsx` — tighter mobile spacing
- `src/routes/admin.index.tsx` — Filters trigger, padded main, header layout, hide bulk toggle on mobile
- `src/routes/client.index.tsx` — Filters trigger, padded main, header layout
- `src/components/vendor/BulkActionBar.tsx` — minor wrap fix on mobile (if needed after testing)

No data, schema, or API changes. Vendor cards themselves already render well at narrow widths after the recent WhatsApp/Call addition.

Approve and I'll implement.