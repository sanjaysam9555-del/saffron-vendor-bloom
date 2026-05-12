# Move admin actions onto the /admin/users page

Today the admin "Admin" link goes to `/admin/users`, which only has the **User Management** section. Add two more sections to that page so it becomes the single home for admin tasks. **Bulk Edit** stays on the vendor list (it only makes sense in that context).

## Page layout (`/admin/users`)

Three stacked sections, each with the same header style as today's "User Management":

```text
User Management              [Create Employee]
  (existing table)

Vendor Submissions           [View all submissions →]
  Quick stats: total / this week / this month
  Link to /admin/submissions

Instagram Sync               [Sync now]
  Short description of what the sync does
  Opens BulkInstagramSyncDialog inline
```

## Changes

### 1. `src/routes/admin.users.tsx`
- Wrap each section in a consistent `<section>` block reusing the existing header pattern (`font-display text-3xl` title + muted description + right-aligned action button).
- Rename the page title to **Admin** (keep `User Management` as the first section heading). Update `head().meta.title` accordingly.
- Add **Vendor Submissions** section:
  - Fetch via existing `useVendors()` and filter `submitted_via_form` (same logic used in `admin.submissions.tsx`).
  - Show three small stat tiles: Total / This week / This month.
  - "View all submissions →" links to `/admin/submissions` (page stays as-is).
- Add **Instagram Sync** section:
  - Short copy explaining what it does.
  - "Sync now" button opens `BulkInstagramSyncDialog` (admin-only; gated by `useAuth().role === "admin"`).
  - Mount the dialog at the bottom of the page with local `open` state.

### 2. `src/components/vendor/TopNav.tsx`
- Remove the standalone `Submissions` link from the top header. (It is now reachable from the Admin page.)

### 3. `src/routes/admin.index.tsx`
- Remove the **Sync Instagram** button from the toolbar above the vendor list (lines ~225–234).
- Keep the **Bulk Edit** button exactly where it is — Bulk Edit is a vendor-list interaction.
- Keep `BulkInstagramSyncDialog` import + state out of this file (no longer needed); the dialog lives on `/admin/users` now.

### 4. No changes
- `admin.submissions.tsx` keeps working unchanged — it is still the destination for the new "View all submissions" link.
- `BulkInstagramSyncDialog`, `BulkEditDialog`, `BulkActionBar` are untouched.
- No backend, schema, or routing changes.

## Files
- `src/routes/admin.users.tsx` — add Submissions and Instagram Sync sections.
- `src/components/vendor/TopNav.tsx` — remove Submissions link.
- `src/routes/admin.index.tsx` — remove Sync Instagram button (keep Bulk Edit).
