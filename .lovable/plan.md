## Goal

On the admin project page (`/admin/projects/:id`), add a search panel above the "Assigned vendors" section so an admin can quickly find a vendor in the library, preview it as a compact card, and add it to this project with one click.

## UX

Placement: at the top of the `AssignedVendorsSection` (above the heading/StatusCountsRow), inside a collapsible panel headed "Quick add vendor". Collapsed by default; opens with a "+ Add vendor" button so it doesn't crowd the page.

When opened:
- A search input ("Search by vendor name, category, subcategory, location…"), autoFocus.
- Below the input, live results render as compact preview cards (max ~8 visible, scrollable). Empty query shows a hint ("Type to search the vendor library"). No matches shows an empty state.
- Each preview card shows: vendor name, category · subcategory, location, price_text, Google/Saffron rating chips — same visual language as the existing assigned-vendor list cards, but smaller.
- Right side of each card has an action button:
  - If the vendor is already assigned to this project → disabled "Added" pill (muted, with check).
  - Otherwise → "Add to this project" button (terracotta, primary).
- Clicking "Add to this project" calls `assignVendorToProject({ project_id: id, vendor_id: v.id })`, shows a success toast, optimistically marks the card as "Added", and invalidates `["project", id]` and `["vendor-project-assignments"]` so the Assigned vendors list updates immediately. The panel stays open so the admin can add several vendors in a row.

## Data

- Reuse existing `useVendors()` hook (already cached, staff-gated) to get the full vendor list.
- Filter client-side on the search term across `vendor_name`, `category`, `subcategory`, `location` (case-insensitive). Debounce isn't needed — it's a local filter.
- Compute the already-assigned set from `vendors` prop already in `AssignedVendorsSection` (it's the project's assigned vendors).
- Mutation: `useMutation` wrapping `assignVendorToProject` with the same invalidations used by the existing remove flow.

## Files

- New component: `src/components/admin/QuickAddVendorPanel.tsx` — owns the collapsible panel, search input, results list, preview card, and the add mutation. Props: `{ projectId: string; assignedVendorIds: Set<string> }`.
- Edit: `src/routes/admin.projects.$id.index.tsx` — render `<QuickAddVendorPanel projectId={projectId} assignedVendorIds={new Set(vendors.map(v => v.id))} />` inside `AssignedVendorsSection`, right above the header row (line ~645).

## Out of scope

- Creating brand-new vendors from this panel (use the existing Vendor library flow).
- Editing vendor fields inline.
- Bulk add / multi-select.
- Mobile-specific redesign beyond the standard responsive stacking already used in this page.
