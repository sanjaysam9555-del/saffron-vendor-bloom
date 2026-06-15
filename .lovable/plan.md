# Striking Animation Upgrades

Five high-impact, distinctly on-brand motion additions. All respect `prefers-reduced-motion` via the existing `useReducedMotion` hook and degrade to instant state changes.

---

## 1. Marigold petal shower on booking finalised
Replace the generic confetti burst in `src/lib/celebrate.ts` with a custom canvas-confetti shape using marigold-petal SVG paths (saffron + deep orange + gold). Slower fall, gentle rotation drift, ~2s, single burst. Triggered from the existing `onSuccess` in `useSetVendorStatus.ts` — no new call sites.

## 2. FLIP board card reorder (client side)
In `ClientBoardColumn.tsx` / `ClientBoardCard.tsx`, wrap each card with Motion's `layout` prop and the column list with a shared `LayoutGroup`. When a vendor moves columns or reorders, sibling cards smoothly animate to new positions instead of snapping. Spring tuned warm (stiffness ~260, damping ~28).

## 3. Timeline rail draw-in
In `VendorTimeline.tsx`, convert the connecting rail to an SVG path and animate `pathLength` from 0 → 1 on first mount (~900ms, ease-out). Marker dots fade/scale in staggered along the rail as it reaches them. Only on initial view per session (sessionStorage flag) so navigation back doesn't replay.

## 4. Shared-element vendor card → detail modal
Use Motion `layoutId` to morph the vendor card's image + title smoothly into the `ClientVendorDetail` modal header on open, and back on close. Requires:
- Matching `layoutId="vendor-image-{id}"` and `layoutId="vendor-title-{id}"` on both `ClientVendorCard.tsx` and `ClientVendorDetail.tsx`.
- Modal mount wrapped in existing `AnimatePresence`.
Fallback: standard scale-in already in place.

## 5. Status pill morph
In `ClientStatusSelect.tsx` / `ClientStatusPill.tsx` (and admin `ClientStatusPill.tsx`), when status changes:
- Background color tweens (not snaps) via Motion.
- Icon swap uses `AnimatePresence` with a small rotate+scale.
- On transitions into a "positive" terminal state (approved/finalised), an SVG checkmark draws in (~250ms) and a soft ring-flash pulses once.

---

## Technical notes
- All work uses the already-installed `motion` + `canvas-confetti`. No new dependencies.
- New helper: `src/lib/petal-shapes.ts` for the marigold SVG path strings.
- Reduced motion: petals → none; FLIP → instant; rail draw → instant full rail; shared-element → standard fade; pill morph → instant color change (checkmark still shown, no draw animation).
- No business-logic, schema, or data-flow changes. Purely presentation.

## Files touched
**Edit:** `src/lib/celebrate.ts`, `src/components/client/ClientBoardColumn.tsx`, `src/components/client/ClientBoardCard.tsx`, `src/components/timeline/VendorTimeline.tsx`, `src/components/client/ClientVendorCard.tsx`, `src/components/client/ClientVendorDetail.tsx`, `src/components/client/ClientStatusSelect.tsx`, `src/components/admin/ClientStatusPill.tsx`
**Create:** `src/lib/petal-shapes.ts`

## Order of implementation
1 → 5 → 3 → 2 → 4 (smallest blast radius first; shared-element last since it touches two components that must stay in sync).
