# Vendor card mobile fixes

Two focused tweaks to `src/components/client/ClientVendorCard.tsx`. No other files touched.

## 1. Remove the negative gap after Instagram link / preview

**Cause:** the info block has `min-h-[6rem]` and the footer is pushed down with `marginTop: "auto"`. On cards with little info (e.g. just an Instagram link) this leaves a large empty gap between the preview strip and the status footer, and the gap size differs per card so the grid looks uneven.

**Fix:**
- Drop the inline `style={{ marginTop: "auto" }}` on the footer block (line 111). Replace with a fixed `mt-3` so spacing below the Instagram strip is consistent on every card.
- Drop `min-h-[6rem]` on the info block (line 57). The strip + footer already give the card a sensible baseline; removing the reserve means cards with only an Instagram link no longer carry ~96px of dead space.
- Keep `h-full` on the card so the grid still aligns row heights; the visual symmetry the user wants is about internal spacing, not card height.

## 2. Status pill getting clipped when a subcategory is present

**Cause:** the chip row (line 41) is `flex-nowrap overflow-hidden` with three `shrink-0` pills (category + subcategory + client status). On a 390px viewport the third pill simply overflows and is clipped by `overflow-hidden`.

**Fix:** change that row to `flex-wrap` and drop `overflow-hidden` and the `min-h-[1.75rem]` reserve. Pills will wrap to a second line when needed; status stays fully visible. Gap stays `gap-1` so wrapping looks intentional.

## Out of scope

Desktop layout, status select component, Instagram preview internals, footer quote chips, View Details button.
