## Problem

In the admin view of a project's timeline, clicking **"Add category to plan"** opens a dialog whose category dropdown hides any category that's already in the timeline. Because the timeline includes every category that has vendors assigned (not just deadline rows), many master-list categories disappear from the dropdown — making it look like only a few categories are available.

## Fix

In `src/components/timeline/VendorTimeline.tsx` → `AddCategoryDialog`:

1. **Stop filtering the dropdown by `existing`.** Render the full `useAllCategories()` list, so admins always see every category from the master list (base + custom).
2. **Keep the duplicate guard.** When the selected category is already on the plan, still show the existing "This category is already on the plan." warning and disable Save — so the dropdown is complete but we don't accidentally overwrite an existing deadline row.
3. **Default `useCustom` to false** whenever the master list has any categories (it currently flips to custom-input mode if `available` is empty, which can happen spuriously now that filtering changes).
4. **Initial `category` value** = first item of the full categories list (not the filtered one).

No backend, schema, server-function, or styling changes. The `existing` prop stays — it's still used to compute `isDup`.

## Out of scope

- Adding/renaming categories from this dialog (the existing "Type a custom name" toggle still covers ad-hoc entries).
- Changes to the timeline filtering logic or to client-mode behaviour.
