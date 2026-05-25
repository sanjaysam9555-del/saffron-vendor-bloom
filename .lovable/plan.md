## Goal

Make the Projects tab visually and structurally match the Vendors tab so switching feels seamless, and drop the descriptive intro line under the Projects title.

## Current state

**Vendors tab** has two stacked regions:
1. A full-width secondary toolbar (`TopNav`): search input on the left, quick stats in the middle, primary action button (`Add Vendor`) on the right.
2. A main content area: page title + result count on the left, then sort dropdown / bulk-edit / view toggle on the right. Filter chips below.

**Projects tab** does not follow this shape:
- Title + descriptive intro paragraph + `New project` button sit together in the header.
- Active/Archived tabs, search input, and sort dropdown live in a separate row below.
- No shared secondary-toolbar pattern with Vendors.

## Changes (UI only, `src/routes/admin.projects.index.tsx`)

1. **Add a Vendors-style secondary toolbar at the top of the Projects pane**, matching `TopNav`'s structure and styling:
   - Left: `Search projects…` input (same width caps, same icon, same focus ring).
   - Middle (lg+ only): quick stats — `{active.length} active`, `{archived.length} archived` in the same muted style as vendor stats.
   - Right: `New project` primary button (same terracotta styling and placement as `Add Vendor`).

2. **Restructure the main content header to mirror Vendors**:
   - Left: `Projects` title + `{filtered.length} of {active.length + archived.length}` count, using the same `brand-line font-display` classes and muted count style as Vendors.
   - Right: Active/Archived tab switcher + sort dropdown, aligned the same way the Vendors row aligns sort / bulk-edit / view toggle controls.
   - **Remove** the intro line ("Each project is one wedding…").
   - **Remove** the now-duplicate search input and `New project` button from this row (they live in the toolbar above).

3. **Keep everything else intact**: project grid, empty state, card behavior, archive/edit/delete handlers, `CreateProjectDialog`, persisted tab state via `useProjectTabState`, realtime invalidation. No business-logic, data, or routing changes.

## Out of scope

- No changes to `TopNav`, vendor pane, sidebar, or any shared chrome.
- No changes to project cards, dialogs, server functions, or queries.
- No new components; the toolbar is implemented inline in the projects route to match `TopNav`'s class structure (small, local, easy to keep in sync visually).
