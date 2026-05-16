## Scope

Mobile-only polish (≤640px) for `/admin/projects/$id` and the timeline/vendor blocks it renders. No business logic, no schema, no server changes. Pure presentation: spacing, button/shape symmetry, and replacing off-brand highlight colors (raw amber/emerald/green/red tints) with brand tokens (`terracotta`, `gold`, `champagne`, `sage`, `cream-deep`).

## Files touched

1. `src/routes/admin.projects.$id.tsx`
2. `src/components/timeline/VendorTimeline.tsx`
3. `src/styles.css` (add two helper tokens only)

## 1. Page container & header — `admin.projects.$id.tsx`

- Outer wrapper: `px-6 py-8` → `px-4 py-6 sm:px-6 sm:py-8` so the mobile gutter matches the rest of the app.
- `ProjectHeader` row (`flex items-start justify-between`) becomes `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4`. Title H1 drops from `text-3xl` to `text-2xl sm:text-3xl`. Edit / Delete buttons sit on their own row on mobile, full-width-equal via `flex-1 sm:flex-none justify-center`.
- "Client login" section header: wrap title block and "Add Client Login" with `flex-wrap gap-2`; button gets `w-full sm:w-auto justify-center` so it never collides with the heading.
- `AssignedVendorsSection` header: title block + view toggle become `flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between`. The "Group by client status" button label shortens to "Grouped" on `<sm` (`<span className="hidden sm:inline">Group by client status</span><span className="sm:hidden">Grouped</span>`).
- Vendor list grid: each card's inner action row currently mixes `VendorQuotesPill`, "Add quote", `SaffronPickToggle`, comments, and a red trash icon at the right edge. On mobile the trash floats out of alignment because the parent uses `items-start justify-between`. Change to `flex-col sm:flex-row` so the trash button moves to a small top-right absolute anchor (`absolute top-2 right-2`) and the action pills wrap cleanly below the vendor meta row.
- Off-brand utility colors in this file get re-skinned:
  - Trash buttons: `text-red-600 hover:bg-red-50` → `text-[var(--charcoal)]/55 hover:text-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]`.
  - Closed-quote pill: `border-green-200 bg-green-50 text-green-800` → `border-[var(--sage)] bg-[var(--sage)]/40 text-[var(--terracotta)]`.
  - Delete-project button: `border-red-300 text-red-600 hover:bg-red-50` → keep destructive intent but soften: `border-[var(--terracotta)]/30 text-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]`.

## 2. Booking Timeline block — `VendorTimeline.tsx`

- Card padding: `p-4 sm:p-5` is fine, but the header row's tab group overflows next to the title on 390px. Change header to `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`. Tab group becomes full-width on mobile with two equal buttons (`flex-1 justify-center`).
- "X categories have no deadline set yet" strip: replace `border-amber-300 bg-amber-50 text-amber-900` with brand champagne: `border-[var(--champagne)]/60 bg-[var(--cream-deep)] text-[var(--charcoal)]/80`, icon tinted `text-[var(--gold)]`.
- "Booked" badge inside each `CategoryRow`: `bg-emerald-50 text-emerald-700` → `bg-[var(--sage)]/50 text-[var(--terracotta)]` so it matches Saffron's palette. Keep the check icon.
- Criticality chip currently shows the raw word with a flat `cream-deep` background. Re-skin into 3 explicit brand tints (added to `styles.css`):
  - low → `bg-[var(--cream-deep)] text-[var(--charcoal)]/60`
  - medium → `bg-[var(--champagne)]/40 text-[var(--charcoal)]/80`
  - high → `bg-[var(--terracotta-soft)] text-[var(--terracotta)]`
- CategoryRow on mobile: title + meta + Edit button currently use `flex-wrap justify-between`. The Edit button drops onto its own line and looks orphaned. Move Edit to absolute top-right on mobile (`absolute top-2 right-2 sm:static`), give the row `relative pr-10 sm:pr-3`.
- TableView: keep horizontal scroll, but raise the scroll container's right-edge hint by adding `shadow-[inset_-12px_0_8px_-8px_rgba(0,0,0,0.08)]` so users see it scrolls.
- DeadlineEditor: stack vertically by default — `grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]` stays, but the action row's Save/Clear become `flex w-full justify-end sm:w-auto` so they don't span a half-empty row on mobile.
- Update urgency-bucket left border accent from `4px solid` to `3px solid` so the rounded-lg corner doesn't visually tear on small cards.

## 3. `styles.css` additions

Add two helper tokens reused by both files (no override of existing tokens):

```css
:root {
  --criticality-low-bg: var(--cream-deep);
  --criticality-med-bg: hsl(30 50% 70% / 0.4);   /* champagne 40% */
  --criticality-high-bg: var(--terracotta-soft);
}
```

That's it — everything else uses tokens already defined.

## Out of scope

- Notifications when items tip into Urgent/Overdue (already deferred).
- Desktop layout changes — desktop currently looks correct, all changes are guarded behind `sm:` breakpoints.
- Client-side dashboard styling (separate request earlier).
- Any data-shape, RLS, or server-function edits.

## Verification

After implementing, navigate to `/admin/projects/<id>` at 390×844 viewport, screenshot full page, and confirm:
- No element overflows horizontally.
- ProjectHeader title and action buttons sit on two clean rows.
- Timeline urgency strip, booked badge, and criticality chips all use cream/champagne/terracotta tints (no raw amber/emerald/green/red).
- Vendor cards: trash icon anchored top-right, action pills wrap symmetrically.
- Tab groups (Timeline/Table, List/Grouped) are full-width with equal-width buttons.
