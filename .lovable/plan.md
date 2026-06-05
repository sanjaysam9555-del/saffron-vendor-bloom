Implement the quote pill label update across all vendor card/table surfaces.

What will change:
- Add a shared helper that converts quote order into labels like `1st`, `2nd`, `3rd`, `4th`.
- Derive each quote’s sequence from the existing quote list sorted by creation date, oldest first.
- Update client-side vendor cards so open quote pills show labels like `1st Quote`, `2nd Quote`, etc.
- Update client-side vendor table quote pills with the same labeling.
- Update admin/project vendor quote pills with the same labeling.
- If a quote is closed, show `Closed Quote` instead of the ordinal label.

Technical details:
- Edit `src/lib/quote-types.ts` to expose `ordinal()` and `buildQuoteSeqMap()`.
- Edit `src/components/client/ClientVendorCard.tsx`.
- Edit `src/components/client/ClientVendorTable.tsx`.
- Edit `src/routes/admin.projects.$id.index.tsx`.
- No database changes are needed; quote order is derived from already-loaded quote data.