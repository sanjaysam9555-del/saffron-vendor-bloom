# Plan: Delete-vendor feedback + Client-side board view

## 1. Delete vendor feedback (admin)

**Issue**: Clicking "Confirm Delete" calls `onDelete()` and silently closes the panel — no spinner, no toast, no animation. If the request is slow the user has no idea anything happened.

**Fix** (in `src/components/vendor/VendorDetail.tsx`):
- Add a `deleting` local state. While `onDelete()` is in flight:
  - Disable both Confirm/Cancel buttons.
  - Replace the button label with a spinner + "Deleting…" (using `Loader2` from lucide).
- On success, fire `toast.success("Vendor deleted")` from sonner.
- On error, surface `toast.error(err.message)` and re-enable the buttons.
- Add a brief fade-out animation on the detail panel before close (use the existing `animate-fade-out` utility — wrap the close call in a 150 ms timeout after success).

`src/routes/admin.index.tsx` already calls `remove.mutateAsync` inside `onDelete`, which throws on failure — so the component just needs to await + try/catch. No server-side change.

## 2. Client board (Kanban) view

**Goal**: A new view on `/client` where vendors are arranged in columns by their `client_status`. Dragging a card across columns updates the status (reuses the existing `setMyVendorStatus` server function — same one the dropdown calls).

### Columns
Six columns, in this order:
1. **No status** (vendors where `client_status === null`)
2. **We like it** (`like`)
3. **Shortlisted** (`shortlisted`)
4. **Need to think about it** (`thinking`)
5. **Finalised** (`finalised`)
6. **Rejected** (`rejected`)

Each column shows its colored header (reusing `CLIENT_STATUS_OPTIONS` colors), a count, and the vendor cards inside.

### View toggle
Add a small **Grid / Board** toggle in `ClientTopNav` (or inline above the grid in `client.index.tsx`). Persist the choice in `localStorage` so the view stays put across reloads.

### Drag-and-drop library
Install **`@dnd-kit/core`** + **`@dnd-kit/sortable`** (small, accessible, React 19 compatible, ~works on touch + mouse + keyboard). These are the de-facto choice for modern React DnD.

### Components to add
- `src/components/client/ClientBoardView.tsx` — wraps `DndContext`, renders six `ClientBoardColumn`s, owns the optimistic update + mutation.
- `src/components/client/ClientBoardColumn.tsx` — droppable column with header + status pill + count + vertical list of cards.
- `src/components/client/ClientBoardCard.tsx` — compact draggable card (vendor name, category chip, location, mini "View Details" link). Smaller than the grid card so a column shows several at once.

### Behavior
- **Drag start**: card lifts (shadow + slight scale, `animate-scale-in`).
- **Drop on a column**: optimistically move the card and call `setMyVendorStatus` with the new status (`null` for the "No status" column). Reuses the same retry/optimistic pattern from `ClientStatusSelect`, so we'll factor that pattern into a small `useSetVendorStatus()` hook in `src/hooks/useSetVendorStatus.ts` and reuse it from both the dropdown and the board.
- **On error**: revert the card and `toast.error`.
- **Filters + search**: the existing sidebar filters and search box still apply — only the matching vendors appear in the board.
- **Click (without drag)**: opens the same `ClientVendorDetail` panel.

### Files touched
- `src/components/vendor/VendorDetail.tsx` — delete UX (toast + spinner + fade).
- `src/hooks/useSetVendorStatus.ts` — new shared mutation hook.
- `src/components/client/ClientStatusSelect.tsx` — switch to the shared hook.
- `src/components/client/ClientBoardView.tsx`, `ClientBoardColumn.tsx`, `ClientBoardCard.tsx` — new.
- `src/routes/client.index.tsx` — Grid/Board toggle and conditional render.
- `package.json` — add `@dnd-kit/core` and `@dnd-kit/sortable`.

### Out of scope
- Reordering vendors *within* a column (kept simple — only the column they're in matters; within a column they stay sorted by vendor name).
- Multi-select / bulk move.
