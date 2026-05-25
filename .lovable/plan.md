
## Goal

Make `/admin` and `/admin/projects` feel like one app with one persistent header. Switching tabs should never re-mount the chrome and should feel instantaneous.

## Problems today

1. `/admin/projects` doesn't render `TopNav` at all — it ships its own page-shell with a "Back to vendor dashboard" link, a different background container, and a different heading style.
2. The "Back to vendors" link duplicates what the `DashboardSwitch` already does.
3. Switching tabs unmounts the entire `TopNav` (because each route owns its own header), so the user sees a brief blank/flash while the projects route's data query (`["projects"]`) loads.

## Fix

### 1. Introduce a shared admin layout route
Create `src/routes/admin.tsx` as a TanStack layout for everything under `/admin/*`. It owns the persistent chrome:

- Logo + brand block
- `DashboardSwitch` (Vendors ⇄ Projects)
- `NotificationsBell` + `UserMenu`
- `<Outlet />` for child routes

Because the layout never unmounts when navigating between `admin.index` and `admin.projects.index`, the header stays visually identical and the switch is instant.

### 2. Split TopNav into chrome + context toolbar

Today `TopNav` mixes shared chrome with vendor-only bits (search vendors, Add Vendor, totals). Refactor:

- **`src/components/admin/AdminShellHeader.tsx`** (new) — pure chrome, used by the layout. Has the logo, `DashboardSwitch`, notifications, user menu. No vendor props.
- **`src/components/vendor/VendorToolbar.tsx`** (new) — vendor search input, Add Vendor button, totals/lastAdded. Rendered inside `admin.index.tsx` directly below the chrome.
- **`src/components/admin/ProjectsToolbar.tsx`** (new) — projects search input, sort, New Project button, Active/Archived tabs. Rendered inside `admin.projects.index.tsx`.
- Delete the existing `TopNav` once both call sites are migrated (or keep it as a thin wrapper composing the two new pieces — decided during implementation).

Result: both pages share the exact same top band; only the slim toolbar beneath it changes.

### 3. Clean up projects page

In `src/routes/admin.projects.index.tsx`:
- Remove the "Back to vendor dashboard" link entirely.
- Drop the bespoke `min-h-screen bg-[var(--cream)] px-… py-…` outer container — let the layout supply the background and the page just renders its toolbar + cards in the same `max-w-[1600px]` container the vendor page uses.
- Replace the page-level `<h1>Projects</h1>` block with the new `ProjectsToolbar` so the visual rhythm matches the Vendor page (where the H1 is small and lives next to filters).

### 4. Clean up project detail page

In `src/routes/admin.projects.$id.tsx`:
- Remove the "Back" link in the header — the persistent `DashboardSwitch` + a breadcrumb-style "Projects / {couple name}" link is enough.
- Keep the rest of the page (KPIs, tabs, archive/view-as-client) unchanged.

### 5. Make the switch instant

Two complementary tweaks:

1. **Prefetch on intent.** In `DashboardSwitch`, on `onMouseEnter`/`onFocus` of each link, call `queryClient.prefetchQuery({ queryKey: ['projects'], queryFn: () => listProjectsOverview() })` (and the equivalent vendors prefetch for the reverse direction). The list is then warm before the click.
2. **Avoid a loading flash when data is cached.** Show the cached list immediately and only show the skeleton when there is truly no cached data (`isLoading && !data`), not on background refetches.

Combined with the persistent layout (no header remount), the switch will feel native-app instant.

### 6. Out of scope

- Client portal chrome.
- The Project Studio tabs (Overview/Quotes/Clients/Notes) — pre-existing plan.
- Visual redesign of the toolbars beyond what's needed to match the vendor page.

## Files

**Create**
- `src/routes/admin.tsx` — layout route with `<Outlet />`
- `src/components/admin/AdminShellHeader.tsx`
- `src/components/admin/ProjectsToolbar.tsx`
- `src/components/vendor/VendorToolbar.tsx`

**Edit**
- `src/routes/admin.index.tsx` — drop `<TopNav>`, render `<VendorToolbar>` instead
- `src/routes/admin.projects.index.tsx` — drop bespoke shell + back link, render `<ProjectsToolbar>` + cards
- `src/routes/admin.projects.$id.tsx` — drop the "Back" link in the header
- `src/components/admin/DashboardSwitch.tsx` — add hover/focus prefetch for `["projects"]` and `["vendors"]`
- `src/components/vendor/TopNav.tsx` — delete or reduce to a re-export composing the new pieces

**Auto-regenerates**
- `src/routeTree.gen.ts`

No migrations, no server-function changes, no business-logic changes.
