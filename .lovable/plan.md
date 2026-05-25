## Goal
Make Vendors ⇄ Projects switching flawless: no intermittent crash, no full-page error, and no unnecessary refetch when toggling tabs.

## Plan
1. Replace the current “keep hidden panes mounted” approach with “only mount the active pane”.
   - The current vendor pane keeps a virtualized grid alive while hidden.
   - That hidden virtualized layout is the most likely cause of the intermittent React update loop.

2. Keep both datasets warm in cache from the admin layout.
   - Preload vendors and projects queries at the `/admin` layout level.
   - This preserves near-instant switching without relying on hidden DOM.
   - Switching tabs becomes a remount of the visible pane, but data should already be ready.

3. Preserve vendor/projects UI state outside the pane components.
   - Lift vendor UI state that should survive tab switches: search, filters, sort, view mode, bulk-mode selection policy if needed.
   - Lift project UI state that should survive tab switches: active/archived tab, search, sort.
   - Pass that state into each pane so the screen returns exactly as the user left it.

4. Make the vendor virtual grid safe for route/tab visibility.
   - Stop measuring when not visible, or avoid mounting it unless the Vendors tab is active.
   - If needed, add a visibility-aware guard in `VirtualGrid` so resize/measurement logic does not run for hidden content.

5. Keep the shared admin chrome unchanged.
   - Header and tab switcher remain persistent.
   - Detail pages like project details still render through `Outlet` as they do now.

## Files likely to change
- `src/routes/admin.tsx`
- `src/routes/admin.index.tsx`
- `src/routes/admin.projects.index.tsx`
- `src/components/ui/VirtualGrid.tsx`

## Technical details
- Root cause matches known `@tanstack/react-virtual` behavior when lists are hidden with `display: none` / hidden containers and still receive `ResizeObserver` measurements.
- Safer architecture: cache data + preserve UI state separately, instead of preserving the entire hidden DOM tree.
- This should remove the intermittent crash while keeping the switch visually immediate.

## Validation
- Switch Vendors → Projects → Vendors repeatedly.
- Confirm no error boundary appears.
- Confirm vendors/projects data does not visibly reload on each toggle.
- Confirm vendor filters/search/view and project search/sort/tab state remain intact after switching.