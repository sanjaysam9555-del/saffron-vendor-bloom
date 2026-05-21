## 1. Edit client display name on the project detail page

On `/admin/projects/:id`, the **Client logins** table already lets you edit the email (pencil icon) and reset the password, but the **Name** column (the display name captured when creating the client login) is read-only.

**Change**
- In `src/routes/admin.projects.$id.tsx`, in the client login row component (around the `{c.display_name || "—"}` cell), add an inline edit affordance mirroring the existing email edit:
  - Pencil icon to enter edit mode
  - Text input + Check/Cancel buttons
  - Disabled save when value is empty
- Reuse the existing `setUserDisplayName` server function (already used by `admin.users.tsx` and accepts `{ user_id, display_name }`).
- On success, show toast, call `onChanged()` to refresh, exit edit mode.

No database or server-side changes needed.

## 2. Three new vendor filters on `/admin`

Add filter toggles in the Sidebar under existing filters (Reviews, Locations, Submitted via form):

1. **Assigned to any project** — vendor appears in `project_vendors`
2. **Has quote history** — vendor appears in `project_vendor_quotes`
3. **Has attachment** — vendor appears in `vendor_attachments`

Each is a tri-state chip group: `Any` / `Yes` / `No` (consistent with the existing "Submitted via form" filter).

**Server change** (`src/server/vendors.functions.ts`)
- Extend `listVendorsServer` to additionally fetch the set of vendor IDs present in:
  - `project_vendors` (distinct `vendor_id`)
  - `project_vendor_quotes` (distinct `vendor_id`)
  - `vendor_attachments` (distinct `vendor_id`)
- Attach three derived boolean fields to each returned vendor row: `has_assignment`, `has_quote_history`, `has_attachment`.

**Type change** (`src/lib/vendor-api.ts` / wherever `Vendor` is typed)
- Add the three optional booleans to the `Vendor` type.

**Client filter state** (`src/components/vendor/Sidebar.tsx`)
- Extend `FilterState` with `assignedToProject: "any" | "yes" | "no"`, `hasQuoteHistory: "any" | "yes" | "no"`, `hasAttachment: "any" | "yes" | "no"` (defaults `"any"`).
- Add a "Relationships" section with three chip groups matching the existing "Submitted via form" pattern.
- Update `clearAll` and the active-filter detector.

**Filter logic** (`src/routes/admin.index.tsx`)
- In the `filtered` memo, apply the three new filters against the derived booleans.
- In `ActiveFilterChips`, add removable chips for each active filter ("Assigned: Yes", "Has quotes", "Has files", etc.).
- Update the `filtersActive` check that controls the mobile filter badge.

## Out of scope
- Editing bride/groom names or wedding date (already supported on project detail page via the pencil icon next to the project title).
- Editing client email (already supported).
- Changes to filtering UI for non-staff users.