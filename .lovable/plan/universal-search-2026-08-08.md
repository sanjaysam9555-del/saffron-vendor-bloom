# Universal Search

Add a search icon to every header (admin desktop sidebar top, admin mobile top bar, client top nav, client sidebar) that opens a translucent, full-app search overlay.

## Behaviour

- Icon in header + keyboard shortcut (Cmd/Ctrl+K, and `/`). Esc closes.
- Overlay: frosted translucent backdrop, centred glass panel, single input, grouped results, arrow-key navigation, Enter opens.
- Typing searches everything the signed-in user is allowed to see, debounced (~200ms), grouped by type with counts:
  - Vendors (name, category, location, contact)
  - Projects (bride/groom names, notes)
  - Quotes (vendor name + quote text/notes, amount)
  - Tasks (title, remarks, owner)
  - Comments (body, with vendor + project context)
  - Calendar / deadlines (wedding dates, category deadlines, payment due dates)
  - Alerts / notifications (title, body)
- Each result shows a type chip, title, and a context line (e.g. "Project: Aisha & Rohan").
- Clicking a result navigates to the exact place: vendor detail, project tab, the task board card, the comment thread, the calendar date, the alert.
- Empty state shows recent searches (localStorage) and a few quick links; no-match state offers "search all vendors" style fallbacks.

## Role scoping

- Admin: everything.
- Employee: everything except commission/analytics-derived results — quote results show client price only, never incentive/commission.
- Client: only their own project — their vendors, their quotes (client price only), their comments, their alerts, their timeline dates. No tasks, no financial internals.

## Technical notes

- New server function file `src/lib/universal-search.functions.ts` with a single `universalSearch({ q })` using `requireSupabaseAuth` + `context.supabase`, so RLS enforces visibility. It runs parallel `ilike` queries per entity (limit ~5 each) and returns a flat DTO list: `{ type, id, title, subtitle, context, route, params, search }`.
- Commission columns are never selected in that function, for any role.
- New components: `src/components/search/UniversalSearchDialog.tsx` (overlay + result list), `src/components/search/UniversalSearchButton.tsx` (header icon), and a small `useUniversalSearch` store for open state so the shortcut works from any layout.
- Results fetched with TanStack Query keyed on the debounced term, `staleTime` short, `enabled: q.length >= 2`.
- Navigation via TanStack Router `navigate` with the route/param payload returned by the server; project sub-targets use existing tab search params so the right tab opens.
- Motion respects the existing reduced-motion hook; overlay uses `backdrop-blur` utilities (no hand-written webkit prefixes).
