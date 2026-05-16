## Goal
Mobile-only polish for `/admin/projects/$id`. Two issues:
1. Edit & Delete sit below the title as full-width buttons, eating vertical space and breaking symmetry.
2. The Client login table card uses `-mx-6` on mobile, but the page container is now `px-4` — so the card overshoots the viewport by 2px on each side, causing the table to be clipped left & right.

Pure presentation changes, no logic/data.

## Changes

### `src/routes/admin.projects.$id.tsx`

**1. `ProjectHeader` (lines ~893–921) — icon-only actions in top-right on mobile**
- Place Edit & Delete absolutely in the top-right corner of the header on mobile, anchored next to the "All projects" back link area.
- Render as 36×36 square icon buttons (no label) below `sm`, restore the labeled pill style at `sm` and up.
- Drop the `flex-1` stretching and the stacked column layout that pushed buttons under the title.
- Result on mobile: title + date sit in a clean single column; two small icon buttons hover top-right; meaningful breathing room below before the "Client login" section.

Concretely:
- Wrap the header in `relative`.
- Title block stays `min-w-0`.
- Actions container becomes `absolute right-0 top-0 flex items-center gap-1.5 sm:static`.
- Edit button: `h-9 w-9 p-0 justify-center sm:h-auto sm:w-auto sm:px-3 sm:py-1.5`, hide the "Edit" text with `hidden sm:inline`.
- Delete button: same treatment, hide "Delete" text below `sm`. Use `aria-label` + `title` for accessibility.
- Add `mt-5 sm:mt-4` so the title clears the floating icon row visually, and keep the existing `mt-8` gap to the next section (already fine).

**2. Client login table clipping (line ~217)**
- Change `-mx-6 sm:mx-0` → `-mx-4 sm:mx-0` so the bleed exactly matches the new `px-4` page padding. The horizontal scroller (`overflow-x-auto`) keeps long emails accessible without clipping the card edges.
- Keep `sm:rounded-lg sm:border` so the desktop card look is preserved.

**3. Spacing tidy under header**
- The "Client login" section currently uses `mt-8`. With the icons floating top-right and a shorter header on mobile, bump to `mt-6 sm:mt-8` so mobile feels tighter without crowding desktop.

## Out of scope
- Desktop layout (unchanged above `sm`).
- Vendor cards, timeline, quotes panel, comments modal.
- Any backend / data shape / RLS.
