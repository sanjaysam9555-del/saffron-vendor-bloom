## Problem

In the client view, the inline deadline editor (rendered inside each category card on the Timeline) overflows the card width. The "Actual Cost" field visibly bleeds past the right edge of the card, and the Save button drops outside the dotted card boundary.

Root cause is in `src/components/timeline/VendorTimeline.tsx` around line 954, the `DeadlineEditor` row:

```
sm:grid-cols-[auto_auto_auto_auto_1fr_auto]
```

combined with fixed-width inputs (`w-32` on Planned Budget, `w-36` on Actual Cost) and no `min-w-0` on the grid children. At the card's available width (~720px on this viewport) the sum of intrinsic column widths exceeds the container, so the grid overflows horizontally instead of wrapping.

## Fix (frontend-only, presentation)

In `src/components/timeline/VendorTimeline.tsx`, update the `DeadlineEditor` container and field cells so the row fits inside the card and wraps gracefully on narrower widths:

1. Replace the grid template with a responsive layout that wraps:
   - Mobile: 2 columns (current behavior is fine).
   - `sm`: 3 columns.
   - `lg`: a single row using `auto` for date / criticality / amounts and `1fr` for Notes, with the action buttons in their own row that right-aligns.
   - Add `min-w-0` to each `<label>` cell so inputs can shrink.

2. Remove the fixed `w-32` / `w-36` on the Planned Budget and Actual Cost inputs; let them be `w-full` and shrink with the column.

3. Move the Save/Clear buttons into their own row that spans the full width and right-aligns, so they never push the form off the card on intermediate widths.

No business logic, no server function, no schema changes. Pure CSS / Tailwind tweak inside `DeadlineEditor`.

## Verification

- Reload `/client`, expand a category card on desktop (~838px viewport from the screenshot) and confirm no horizontal overflow of the cream editor block.
- Resize to ~400px mobile width: fields stack to 2 columns, nothing overflows.
- Resize to ~1200px: fields sit on one row, Notes takes the remaining space, Save/Clear pinned right.
