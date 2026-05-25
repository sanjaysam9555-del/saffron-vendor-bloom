## Goal

Switching between **Vendors** and **Projects** in the admin shell should be visually instant: no loading skeletons, no data refetch, no lost search/filter/scroll state.

Today each tab is a separate file route (`/admin` and `/admin/projects`). Every switch unmounts one page and mounts the other, which:
- re-runs `useQuery` (skeletons flash until cache resolves),
- resets local state (search, filters, view mode, scroll position),
- re-creates lazy chunks and Instagram preview subscriptions.

Prefetching alone can't fix lost state or unmount cost. The fix is to keep **both** pages mounted inside the existing `/admin` layout and toggle visibility.

## Approach: render both panes inside the admin layout

The `/admin` layout route already owns the persistent chrome (`AdminShellHeader`). Extend it so the body also owns both panes:

```text
/admin layout
├── AdminShellHeader (already persistent)
└── Body
    ├── <VendorsPane />    ← visible when pathname === /admin
    └── <ProjectsPane />   ← visible when pathname starts with /admin/projects
```

The currently inactive pane stays mounted but is hidden with the `hidden` HTML attribute (`display:none`) — React keeps its state, queries, and scroll position. Switching tabs becomes a pure CSS toggle.

Detail routes (`/admin/projects/$id`, `/admin/projects/$id/preview/$clientId`, `/admin/submissions`, `/admin/users`) still render via `<Outlet />` and replace the panes when active.

### Files

**Extract page bodies into plain components (no route wrappers):**
- `src/components/admin/VendorsPane.tsx` — move the `DashboardPage` body from `src/routes/admin.index.tsx` into a component, exporting `VendorsPane`.
- `src/components/admin/ProjectsPane.tsx` — move the `ProjectsListPage` body from `src/routes/admin.projects.index.tsx` into a component, exporting `ProjectsPane`.

Both panes keep all current state (`useState` for search/filters/sort/view), queries, and realtime subscriptions exactly as they are. No business logic changes.

**Update `src/routes/admin.tsx` (layout):**
- Read `pathname` via `useRouterState`.
- Compute `onVendors = pathname === "/admin"`, `onProjects = pathname === "/admin/projects"`, `onOther = !onVendors && !onProjects`.
- Render:
  ```tsx
  <AdminShellHeader />
  <div hidden={!onVendors}><VendorsPane /></div>
  <div hidden={!onProjects}><ProjectsPane /></div>
  {onOther && <Outlet />}
  ```
- This keeps both panes warm; detail/sub-routes (`/admin/projects/$id`, `/admin/submissions`, `/admin/users`) replace them via `<Outlet />` and never collide with the hidden panes.

**Shrink the index routes to no-op components** (the layout renders the panes; the routes only need to exist so the router matches the URL):
- `src/routes/admin.index.tsx` → keep `head()`, `AuthGate`, but `component` becomes `() => null`. Move `DashboardPage` body into `VendorsPane`.
- `src/routes/admin.projects.index.tsx` → same treatment, body moves into `ProjectsPane`.

**Simplify `DashboardSwitch.tsx`:**
- Remove the on-hover `prefetchQuery` — no longer needed, projects pane is already mounted and its query already ran on first paint.
- Keep `Link`s and active-tab styling.

### Preloading on first admin visit

Because both panes mount the first time `/admin/*` is opened, both `useQuery(["vendors"])` and `useQuery(["projects"])` fire immediately in parallel. The user pays one initial load, then every subsequent switch is a zero-network CSS toggle.

### Trade-offs (acknowledged, acceptable)

- Memory: both grids and their realtime channels are mounted on every `/admin/*` page. The existing realtime hooks already dedupe by channel name, and both panes are lightweight after first render.
- First admin visit fetches both lists in parallel instead of one. Net feel is faster because the second tab never loads again.
- When the user opens a detail route (e.g. `/admin/projects/$id`) the panes are hidden via `hidden`-style outlet replacement; their queries remain cached, so returning to the list is also instant.

### Out of scope

- No changes to detail routes, server functions, RLS, or business logic.
- No changes to client portal or vendor onboarding.
- No visual redesign — only the mount strategy changes.

## Files touched

Create:
- `src/components/admin/VendorsPane.tsx`
- `src/components/admin/ProjectsPane.tsx`

Edit:
- `src/routes/admin.tsx` (render both panes + Outlet)
- `src/routes/admin.index.tsx` (component → null wrapper)
- `src/routes/admin.projects.index.tsx` (component → null wrapper)
- `src/components/admin/DashboardSwitch.tsx` (drop prefetch handlers)

Auto-regenerates:
- `src/routeTree.gen.ts`

No migrations.
