# Plan: Admin view of client vendor selections

## Goal

From the admin panel, let staff see — for any project — exactly which vendors the project's client(s) have marked as Liked, Shortlisted, Finalised, Rejected, or "Need to think about it".

## Where it lives

The project detail page already exists at `/admin/projects/$id` and lists the project's clients and assigned vendors. This is the natural home — no new top-level page needed.

We add three things to that page:

1. **Per-project status summary (counts)** — small chip row at the top:
   `Liked 4 · Shortlisted 2 · Finalised 1 · Rejected 3 · Thinking 2 · No response 8`
2. **Status column on each assigned vendor row** — a colored pill showing what the client marked. If the project has more than one client login, the pill shows the most recent client's status and hovering reveals a per-client breakdown.
3. **"Client View" toggle** — a button on the page header that switches the vendor list into a grouped view:
   ```text
   ❤ Finalised (1)
     - Cupcake Productions  (marked by bride@…)
   ★ Shortlisted (2)
     - …
   ✗ Rejected (3)
     - …
   • No response yet (8)
     - …
   ```
   Same data, just regrouped so staff can quickly answer "what did they pick?"

A separate **`/admin/projects` index enhancement**: each project card gets a tiny stat line (`✓ 1 finalised · ★ 2 shortlisted · 12 vendors`) so you can scan all 10 dashboards at once without opening each.

## What to build

### Backend (server functions)
- New `getProjectClientSelections({ project_id })` in `src/server/projects.functions.ts`. Uses `supabaseAdmin` (staff-only, gated by `requireStaffUser`). Returns: for each assigned vendor, the list of `{ user_id, display_name, status }` rows from `client_vendor_status` joined with `profiles`. Also returns aggregate counts.
- New `getProjectsOverview()` — extends `listProjects` with per-project status counts (one round-trip, grouped server-side) for the projects list page.

No DB schema changes needed — `client_vendor_status` already stores everything.

### Frontend
- `src/routes/admin.projects.$id.tsx`: add the summary chip row, status pill per vendor row, and the "Group by client status" toggle. Reuse `CLIENT_STATUS_OPTIONS` from `src/lib/client-status.ts` for colors so admin and client see identical pills.
- `src/routes/admin.projects.index.tsx`: add the per-card stat line.
- New small component `src/components/admin/ClientStatusPill.tsx` so the same pill renders consistently in cards, rows, and the grouped view.

## Out of scope (for now)
- Editing a client's status from the admin side (read-only — if you want this later, say the word).
- Notifications when a client changes a status.

## Files touched
- `src/server/projects.functions.ts` — add 2 server functions
- `src/routes/admin.projects.$id.tsx` — summary, pills, grouped view toggle
- `src/routes/admin.projects.index.tsx` — per-card status counts
- `src/components/admin/ClientStatusPill.tsx` (new)
