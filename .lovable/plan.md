
## Goal

Make Projects a first-class admin surface. The admin lands on a unified dashboard with a top-level switch between **Vendors** and **Projects**. Inside Projects, sub-tabs split **Active** and **Archived**. Project cards become richer at-a-glance briefs. Opening a project takes the admin to a **full project page** that surfaces every relevant detail, and a built-in **"View as client"** toggle previews exactly what the assigned client sees.

## 1. Top-level dashboard switch (Vendors ⇄ Projects)

- Add a persistent segmented switch in the admin `TopNav` (visible on `/admin` and `/admin/projects`): `Vendors | Projects`.
- Routes stay clean: `/admin` = Vendors, `/admin/projects` = Projects. The switch navigates between them and shows active state from the current pathname.
- Eyebrow under the logo becomes dynamic ("Vendor Studio" / "Project Studio").
- The `Add Vendor` CTA becomes contextual: on Projects, it turns into `New Project` and opens the create-project dialog.
- Remove the standalone "Projects" entry button on the Vendors dashboard — the switch replaces it.

## 2. Active / Archived sub-tabs

- Add `archived_at timestamptz null` to `projects` (+ index). Non-null = archived.
- Tabs on `/admin/projects`: **Active** (default, nearest wedding first) and **Archived** (most recently archived first). Counts beside each tab.
- Per-card `…` menu: **Archive / Unarchive**, **Edit details**, **Delete** (admin-only, confirm).
- New server fn `setProjectArchived({ id, archived })` (staff-only).
- `listProjectsOverview` returns `archived_at` and a new `closed_total_amount`.

## 3. Richer project cards

New `ProjectCard` component shows:

- **Header**: Bride & Groom, "Wedding" eyebrow, urgency chip (`Today`, `Tomorrow`, `This week`, `Upcoming · 42d`, `Past`, `Archived`).
- **Date row**: full date + day + countdown.
- **Progress strip**: finalised vendors / total assigned, with a thin bar.
- **Client status counts**: reuse `StatusCountsRow`, always rendered for height parity.
- **Money line**: closed total (₹) across all final quotes.
- **People**: client login initials (up to 3 + "+N"), tooltip with emails.
- **Saffron picks**: star + count when any pick exists.
- **Activity**: "Updated <relative time>".
- Subtle lift + terracotta border on hover; right-arrow affordance.

Grid: 2 cols on `sm`, 3 on `xl`. Card height stays consistent regardless of populated data.

## 4. Projects toolbar (search / sort / quick filters)

Above the card grid:

- **Search**: bride/groom name, notes.
- **Sort**: Upcoming first (default) · Recently updated · Most vendors · Most quoted.
- **Quick filters**: `Has unfinalised quotes`, `No client login yet`, `Saffron picks only`, `Wedding in <30 / 60 / 90 days`.
- TopNav search input relabels to "Search projects…" on the Projects tab and feeds the same state.

All client-side filtering over the overview list (volume is low).

## 5. Full project page (admin)

Promote `/admin/projects/$id` from a panel-heavy editor to a proper project workspace. New layout:

- **Header band**
  - Bride & Groom (display font) + urgency chip.
  - Wedding date · countdown · location (if set).
  - Inline KPIs: vendors assigned, finalised, closed ₹, clients linked, open quotes, comments.
  - Right side: `Archive` / `Unarchive`, `Edit project`, `Delete` (admin), and the **View-as-client toggle** (see §6).

- **Tabs** (sticky on scroll)
  1. **Overview** — KPI cards, urgency strip across categories, recent activity feed (comments + status changes + quote events), wedding-day countdown.
  2. **Vendors** — current assignment board (cards or table), grouped by category, with Saffron-pick toggle, per-vendor client statuses, comment counts, and a button to add vendors from the master list. Each vendor row links into the existing `VendorDetail` drawer.
  3. **Quotes** — table across all assigned vendors: status, latest amount, closed amount, final flag, files. Add / edit quotes inline via the existing `ProjectVendorQuotesPanel` flows.
  4. **Timeline & Deadlines** — `project_category_deadlines` editor with the existing `VendorTimeline` + `UrgencyStrip`.
  5. **Clients** — list of client logins for this project: name, email, last sign-in, reset password, change email, change name, remove. Includes the create-client form.
  6. **Notes** — `projects.notes` editor + scratchpad comments.

- All tabs are mounted in a single route file with internal tab state (URL search param `?tab=overview` so deep links survive reloads).
- Keep all existing server fns; this is mostly a UI reshape + extraction into smaller components under `src/components/admin/project/`.

## 6. "View as client" preview toggle

A toggle in the project header switches the page between **Admin view** and **Client view** without leaving `/admin/projects/$id`.

- Implementation: render the same `ClientBoardView` / `ClientVendorDetail` components used by `/client`, but inside a wrapper that passes the project + a chosen client identity (default: the first `project_client`; switcher dropdown lists all linked clients).
- Data is fetched via a new staff-only server fn `getProjectAsClientView({ project_id, client_user_id })` that mirrors what the real `/client` page receives (vendors, statuses for that client, comments, deadlines), but is gated by `assertStaff` rather than RLS-as-that-user. No impersonation tokens — the admin's session stays intact.
- A persistent "Previewing as <Client Name>" banner sits across the top while the toggle is on, with a one-click `Exit preview` and a clear "Read-only — actions are disabled" note.
- Read-only enforcement: in client-view mode, all mutation handlers (status changes, comments, etc.) are no-ops and CTAs are disabled with a tooltip. We do NOT write `client_vendor_status` rows as the client.
- The toggle state is held in local URL search (`?as=client&clientId=...`) so reloads and shares preserve the view.

## 7. What else (extras)

- **Empty / onboarding states**: friendly empty page on Active when zero projects; a different message when Archived has items.
- **Real-time**: extend `useRealtimeInvalidate` on the project page to also invalidate when `projects.updated_at` / `archived_at` change, plus quotes/comments/statuses.
- **Auto-archive nudge**: soft banner on the card and page when `wedding_date` is older than 60 days and not archived ("Archive this project?" one-click).
- **Keyboard shortcuts**: `g v` / `g p` to jump between Vendors / Projects.
- **Deep links**: tab + view-as-client preserved in URL for sharing with teammates.

## Technical sketch

```text
src/
  routes/
    admin.index.tsx                 (Vendors — unchanged logic, gets DashboardSwitch in TopNav)
    admin.projects.index.tsx        (rewritten: tabs + toolbar + ProjectCard grid + create dialog)
    admin.projects.$id.tsx          (rewritten: header band + tabbed workspace + view-as-client wrapper)
  components/
    admin/
      DashboardSwitch.tsx           (NEW — Vendors | Projects segmented control)
      ProjectCard.tsx               (NEW — rich card)
      ProjectsToolbar.tsx           (NEW — search/sort/quick filters/tabs)
      CreateProjectDialog.tsx       (NEW — extracted from inline form)
      project/
        ProjectHeader.tsx           (NEW — KPIs + actions + view-as-client toggle)
        ProjectTabs.tsx             (NEW — Overview/Vendors/Quotes/Timeline/Clients/Notes)
        OverviewTab.tsx             (NEW)
        VendorsTab.tsx              (NEW — wraps existing assignment UI)
        QuotesTab.tsx               (NEW — wraps existing quotes panel)
        TimelineTab.tsx             (NEW — wraps urgency strip + deadlines editor)
        ClientsTab.tsx              (NEW — wraps existing client login mgmt)
        NotesTab.tsx                (NEW)
        ClientPreviewWrapper.tsx    (NEW — renders ClientBoardView read-only)
    vendor/
      TopNav.tsx                    (mount DashboardSwitch; contextual CTA + search placeholder)
  server/
    projects.functions.ts           (+ setProjectArchived;
                                       + closed_total_amount in overview;
                                       + getProjectAsClientView staff-only fn)

supabase migration:
  ALTER TABLE projects ADD COLUMN archived_at timestamptz;
  CREATE INDEX projects_archived_at_idx ON projects (archived_at);
```

No RLS changes — existing staff policies cover the new column and the staff-only preview fn uses `supabaseAdmin`.

## Out of scope (for this pass)

- Redesigning the real `/client` dashboard.
- Bulk actions on projects.
- Audit log of admin previews (can be added later if needed).
