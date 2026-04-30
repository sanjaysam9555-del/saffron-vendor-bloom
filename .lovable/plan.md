## Goal
Allow adding custom categories from the vendor form's category dropdown, persist them so they appear everywhere categories are listed, and sort all category lists alphabetically.

## Approach

Categories are currently a hardcoded constant in `src/lib/categories.ts`. We'll persist user-added categories in `localStorage` (no backend needed — they're just labels and the `vendors.category` column is free text). A small reactive store will make the dropdown and the sidebar update immediately when a new category is added.

### 1. Custom-category store (`src/lib/categories.ts`)
- Keep the existing `CATEGORIES` as `BASE_CATEGORIES` (the built-in list).
- Add helpers:
  - `getCustomCategories()` — reads from `localStorage` key `saffron.customCategories`.
  - `addCustomCategory(name)` — trims, de-dupes (case-insensitive against base + custom), appends, saves, notifies subscribers.
  - `getAllCategories()` — returns base ∪ custom, **sorted alphabetically** (locale-aware).
  - `subscribeCategories(cb)` — pub/sub so React components re-render.
- Add `useAllCategories()` hook (in same file or `src/hooks/use-categories.ts`) that subscribes and returns the sorted merged list.
- `CATEGORY_COLORS`: keep keyed by base names; provide a `getCategoryColor(name)` helper that falls back to the `Miscellaneous` palette for custom categories.

### 2. Vendor form dropdown (`src/components/vendor/VendorForm.tsx`)
- Replace `CATEGORIES` import with `useAllCategories()`.
- Render options sorted alphabetically (already sorted from the hook).
- Append a final option: `__add_new__` → label "+ Add New Category".
- When that value is selected:
  - Show an inline input + Add/Cancel buttons directly under the select.
  - On Add: validate non-empty + not duplicate, call `addCustomCategory()`, then set `form.category` to the new name; hide the input.
  - On Cancel: revert `form.category` to previous value.

### 3. Sidebar category list (`src/components/vendor/Sidebar.tsx`)
- Replace `CATEGORIES` import with `useAllCategories()`.
- The list will be alphabetically sorted automatically.
- Counts (`countsByCat`) already key on actual vendor `category` strings, so custom categories with vendors will show correct counts; categories with zero vendors still render (consistent with current behavior).

### 4. Anywhere else that references `CATEGORIES`
Quick scan showed only `VendorForm.tsx` and `Sidebar.tsx`. `CATEGORY_COLORS` consumers (VendorCard/Table/Detail) will use the new `getCategoryColor()` fallback so custom categories render with a neutral chip color.

## Technical notes
- Storage: `localStorage` (browser-only). Reads guarded with `typeof window !== "undefined"` for SSR safety.
- Sorting: `[...all].sort((a, b) => a.localeCompare(b))`.
- No DB migration needed — `vendors.category` is already free-text.
- No new dependencies.

## Files to change
- `src/lib/categories.ts` — add store, hook, sorted getter, color fallback.
- `src/components/vendor/VendorForm.tsx` — dropdown + inline "Add New Category" UI.
- `src/components/vendor/Sidebar.tsx` — use hook for alphabetized list.
- `src/components/vendor/VendorCard.tsx`, `VendorTable.tsx`, `VendorDetail.tsx` — swap direct `CATEGORY_COLORS[x]` lookups for `getCategoryColor(x)` (only where they currently break for unknown names).