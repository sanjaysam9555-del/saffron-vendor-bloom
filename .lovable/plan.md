## Quote pill: shorter label + compact amount

Tweak `src/lib/quote-summary.ts` only — this is the single source of truth for the pill label used on both client cards and admin views.

### Changes

1. **Drop the word "Received"** from the unclosed-quote label.
   - Before: `1st Quote Received · ₹1,20,000`
   - After: `1st Quote · ₹1,20,000`
   - Revised case stays as `Revised · 2nd Quote · ₹1,20,000`.
   - Closed case stays as `Closed · ₹2,00,000`.

2. **Compact Indian-style amount formatting** via a new `formatINRCompact(amount)` helper that replaces the current `formatINRShort` inside the label:
   - `>= 1,00,00,000` → `₹X.XXCr` (crore, 2 decimals, trim trailing zeros)
   - `>= 1,00,000` → `₹X.XXL` (lakh, 2 decimals, trim trailing zeros)
   - `>= 1,000` → `₹XXK` (thousand, no decimals)
   - `< 1,000` → `₹XXX`

   Examples:
   - `296000` → `₹2.96L`
   - `65000` → `₹65K`
   - `200000` → `₹2L`
   - `12500000` → `₹1.25Cr`
   - `850` → `₹850`

### Scope

- Single-file change: `src/lib/quote-summary.ts`.
- No UI component edits, no server changes, no schema changes — every consumer (`ClientVendorCard`, admin project view, etc.) already calls `quoteSummaryLabel()` and will pick up both changes automatically.