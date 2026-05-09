# Admin dashboard — sort + extra filters

## Scope
Frontend-only on `/admin/`. Extend `Sidebar` (`src/components/vendor/Sidebar.tsx`) and the dashboard page (`src/routes/admin.index.tsx`) — no DB / API changes; everything filters/sorts the already-fetched `vendors` array.

## 1. Extend `FilterState`
```ts
export interface FilterState {
  category: string | null;
  locations: string[];
  minGoogleRating: number | null;     // 3 / 3.5 / 4 / 4.5
  minSaffronRating: number | null;    // 3 / 3.5 / 4 / 4.5
  submittedViaForm: "any" | "yes" | "no";
}
export type SortKey =
  | "date_added_desc"   // Newest added (default)
  | "date_added_asc"    // Oldest added
  | "updated_desc"      // Last modified
  | "name_asc"          // Alphabetical A→Z
  | "name_desc";        // Alphabetical Z→A
```
Default: `{ category:null, locations:[], minGoogleRating:null, minSaffronRating:null, submittedViaForm:"any" }`, sort `date_added_desc`.

## 2. Sidebar — new sections (below Location)
- **Google rating** — chip row "Any · 3+ · 3.5+ · 4+ · 4.5+". Filter keeps a vendor when `v.google_rating != null && v.google_rating >= min`. "Any" clears it.
- **Saffron rating** — same shape, against `v.saffron_rating`.
- **Source** — three chips "All · Form submissions · Manual entry" mapped to `submittedViaForm` ∈ `any|yes|no` (uses `v.submitted_via_form`).

Existing "Clear" button resets the new fields too. Mobile filter dot lights up if any new filter is active.

## 3. Sort dropdown — page header
Add a small `<select>` next to the Cards/Table toggle in `admin.index.tsx`:
> Newest added · Oldest added · Last modified · Name A→Z · Name Z→A

State `sort: SortKey` lives in the page (not the sidebar) — it's a view concern, not a filter.

## 4. Filter + sort pipeline
In the existing `useMemo` after current filters:
```ts
.filter(v => filters.minGoogleRating == null || (v.google_rating ?? -1) >= filters.minGoogleRating)
.filter(v => filters.minSaffronRating == null || (v.saffron_rating ?? -1) >= filters.minSaffronRating)
.filter(v => filters.submittedViaForm === "any"
   || (filters.submittedViaForm === "yes" ? v.submitted_via_form : !v.submitted_via_form))
```
Then sort a copy:
- `date_added_*` → compare `date_added`
- `updated_desc` → compare `updated_at`
- `name_*` → `vendor_name.localeCompare(..., undefined, { sensitivity: "base" })`

## Out of scope
- Client-side dashboard, table column-header sorting, persisting sort in URL.
- Backend — fields already exist on `vendors` (`google_rating`, `saffron_rating`, `submitted_via_form`, `date_added`, `updated_at`).
