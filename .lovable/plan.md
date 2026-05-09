## Apply pill changes to admin project detail page

The previous tweaks (drop "Received", compact `₹2.96L` / `₹65K` formatting) are already live everywhere that reads `quoteSummaryLabel()` — but the admin project detail page (`src/routes/admin.projects.$id.tsx`, the per-vendor quote pill around lines 549–576) hand-rolls its own label using `formatINR` and the literal string `"Quote Received"`. That's why it still shows e.g. `1st Quote Received · ₹1,20,000` while the client board shows `1st Quote · ₹1.2L`.

### Change

In `src/routes/admin.projects.$id.tsx`, replace the inline label logic with the shared helper:

- Import `quoteSummaryLabel` from `@/lib/quote-summary`.
- Build a `QuoteSummary` from the already-fetched `quotes` array:
  - `count = quotes.length`
  - `latest_status = quotes[0]?.status ?? null` (list is newest-first as today)
  - `latest_amount = quotes[0]?.quote_amount ?? null`
  - `has_closed = !!closed`
  - `closed_amount = closed?.closed_amount ?? null`
- Render `quoteSummaryLabel(summary)` for both the closed and unclosed cases. Keep:
  - the "Add quote" state when `quotes.length === 0`,
  - the green check icon + green text styling when closed,
  - the paperclip + file count suffix.
- Drop the now-unused `formatINR` import and the `ordinal` usage in this component if nothing else needs them.

### Result

Admin project detail pill now reads identically to the client board — `1st Quote · ₹1.2L`, `Revised · 2nd Quote · ₹2.96L`, `Closed · ₹2L` — and any future tweak to the label only needs to happen in `quote-summary.ts`.

### Out of scope

- Admin projects index page (`/admin/projects`) only shows aggregate counts ("3 / 5 vendors quoted · 1 closed"), not per-vendor pills, so nothing changes there.
- No server, schema, or other UI changes.
