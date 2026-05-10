## Goal
Remove the vendor `price_text` display from the client-side board view card so clients only see pricing via received quotes.

## Change

**File: `src/components/client/ClientBoardCard.tsx`**

- Remove the block that renders `vendor.price_text` (the terracotta-colored line under the rating in the meta section).
- Leave location, rating, category pills, and quote indicators untouched. Quotes are not shown on this compact board card today; only the base vendor price was leaking through, which violates the rule that clients see prices only via quotes.

## Out of scope
- `ClientVendorCard` (list view) and `ClientVendorDetail` — already audited previously; only fix the board card here unless the user reports another leak.
- Server-side filtering of `price_text` from the client payload (could be a follow-up hardening step, but this task is UI-scoped).
