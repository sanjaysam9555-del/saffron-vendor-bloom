## Saffron's Preference toggle

Add a per-project "Saffron's Preference" marker to vendor cards in the admin Project Detail page. When ON, the matching vendor card on the client's dashboard shows a clearly distinguishable badge so the client can spot the handful of vendors Saffron is recommending from their full pool.

The flag is **per project + vendor**, not global on the vendor — different couples can have different picks.

### Data model

Add column to `project_vendors`:
- `is_saffron_pick boolean not null default false`

RLS already allows clients SELECT and staff ALL on `project_vendors`, so no policy changes — clients can read the flag, only staff can flip it.

### Server functions (`src/server/projects.functions.ts`)

1. **New:** `setVendorSaffronPick({ project_id, vendor_id, is_saffron_pick })` — staff only, updates the row in `project_vendors`.
2. **`getProject`** (admin detail) — include `is_saffron_pick` on each vendor in the returned `vendors` array.
3. **`getMyProject`** (client dashboard) — join the flag from `project_vendors` and include it on each vendor.

### Types

- `src/lib/project-types.ts` → add `is_saffron_pick: boolean` to `ClientVendor`.
- Admin project detail vendor rows already use `any`; just read the new field.

### Admin UI (`src/routes/admin.projects.$id.tsx`)

On each row in the "Assigned vendors" list (around line 452), add a small toggle next to the existing actions:
- shadcn `<Switch>` labelled "Saffron's Preference" with a subtle Sparkles icon.
- Optimistic toggle → call `setVendorSaffronPick` → invalidate `["project", id]`.
- `notifySuccess` / `notifyError` from existing feedback helpers.
- Reuse `useConfirm` only when turning OFF (light confirmation is optional — default to no confirm, since toggling is cheap and reversible).

### Client UI

Add a distinguishable badge to vendor cards when `is_saffron_pick === true`:

1. **`ClientVendorCard.tsx`** (grid view) — top-right ribbon/badge: gradient terracotta pill with `Sparkles` icon + "Saffron's Pick". Also add a thin terracotta accent border / soft inner glow to the whole card so it stands out at a glance.
2. **`ClientBoardCard.tsx`** (kanban) — small Sparkles icon chip next to the category pill.
3. **`ClientVendorTable.tsx`** — Sparkles icon prefix on the vendor name cell.
4. **`ClientVendorDetail.tsx`** — show the badge in the detail header.

Optional polish: add a "Saffron's Picks" filter chip in the client dashboard toolbar to surface only preferred vendors.

### Out of scope

- No email notification when a pick is toggled.
- No analytics on pick views.
- No vendor-side visibility (vendors do not see the flag).
- No bulk-toggle UI (single toggle per row is enough for the handful-per-client use case).

### Sequencing

1. Migration: add `is_saffron_pick` column.
2. Server: extend `getProject` + `getMyProject`, add `setVendorSaffronPick`.
3. Admin UI: toggle on each assigned-vendor row.
4. Client UI: badge on `ClientVendorCard`, `ClientBoardCard`, `ClientVendorTable`, `ClientVendorDetail`.
5. Verify in preview on both admin and client views.