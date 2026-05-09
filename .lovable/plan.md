## Goal
Compact Indian-style amount on the quote chips shown in the client vendor card and the admin project vendor row, while keeping full amounts everywhere else (detail panels, quotes panel, etc.).

Examples:
- `296000` → `₹2.96L`
- `65000` → `₹65K`
- `12500000` → `₹1.25Cr`
- `<1000` → unchanged (e.g. `₹850`)

## Plan

1. **Add helper** `formatINRShort(amount)` in `src/lib/quote-types.ts` (next to `formatINR`):
   - `>= 1_00_00_000` → `₹{n/1e7, max 2 decimals}Cr`
   - `>= 1_00_000` → `₹{n/1e5, max 2 decimals}L`
   - `>= 1_000` → `₹{round(n/1000)}K`
   - else → `formatINR(amount)`
   - Strip trailing `.0` / `.00` so `200000` shows `₹2L` not `₹2.00L`.

2. **Use it in the chip labels only:**
   - `src/components/client/ClientVendorCard.tsx` — replace the inline `Intl.NumberFormat` call inside the quote chip map with `formatINRShort(amt)`.
   - `src/routes/admin.projects.$id.tsx` `VendorQuotesPill` — replace the local `fmtINR` helper with `formatINRShort`.
   - Keep `title` tooltips showing the full `formatINR` value so the exact number is still discoverable on hover.

3. **Out of scope:** detail panel amounts, quotes panel, quote forms, totals — they keep using full `formatINR`.

## Verify
- Card chip and admin row chip show `₹2.96L`, `₹65K`, `₹1.25Cr`, etc.
- Hovering a chip still reveals the exact rupee value.
- Full amounts in the detail panel and quotes panel are unchanged.