# Centered "+ Project" Modal

## Problem
`VendorProjectAssigner` currently renders its picker as an `absolute right-0 mt-1 w-64` panel anchored next to the card's `+ Project` chip. Inside vendor cards (which are now `overflow-hidden` with `min-w-0`) and inside the vendor detail drawer, this anchored panel:
- gets clipped by the card/drawer bounds,
- can be pushed off-screen on mobile,
- causes the surrounding layout to look "auto-zoomed" because the absolute child has no width constraint relative to the viewport.

## Goal
Open the project list as a centered, screen-blurred modal on every viewport (mobile, tablet, desktop), with an internally scrollable project list. Same behavior whether triggered from a `VendorCard` chip or the `VendorDetail` drawer.

## Approach
Refactor `src/components/vendor/VendorProjectAssigner.tsx` to use the existing shadcn `Dialog` (`@/components/ui/dialog`) instead of an absolutely-positioned div.

Specifics:
- Keep the existing trigger chip (`+ Project` / `Assign to project`) and assigned-project pills exactly as they are.
- Replace the `{open && <div className="absolute …">…</div>}` block with:
  - `<Dialog open={open} onOpenChange={setOpen}>` with `<DialogContent>` styled to:
    - Center on screen (default Radix behavior).
    - Width: `w-[calc(100vw-2rem)] max-w-md` so it stays readable on mobile and capped on desktop.
    - Max height: `max-h-[85vh]` with internal flex column.
    - Header: `DialogTitle` "Assign to project" + search input row.
    - Body: project list inside `flex-1 overflow-y-auto` (this is the scrollable region).
- Keep the search input, empty state, and toggle behavior identical.
- Remove the now-unneeded `relative` wrapper and `e.stopPropagation()` on the outer div (Radix Dialog manages its own portal, so card click handlers won't fire from the modal).
- The `DialogOverlay` from shadcn already applies `bg-black/80` plus a subtle blur via the existing styles; confirm `backdrop-blur-sm` is present and add it to the overlay class on `DialogContent` if needed (shadcn's default overlay already blurs).
- After toggling a project with `closeAfter: true`, call `setOpen(false)` and clear search as today.

## Files to change
- `src/components/vendor/VendorProjectAssigner.tsx` — swap absolute popover for `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`. No API changes; `VendorCard` and `VendorDetail` keep their existing usage.

## Out of scope
- No changes to project assignment server logic, queries, or mutations.
- No changes to the assigned-project pill row or the trigger chip styling.
- No changes to other modals/drawers.

## Verification
- Open from a vendor card on 390px width: modal is centered, background blurred, list scrolls inside the modal, page does not zoom or shift.
- Open from the vendor detail drawer on desktop: modal sits above the drawer, centered on the viewport.
- Search filters list; selecting a project toggles assignment and closes the modal; X / overlay click / Esc all close it.
