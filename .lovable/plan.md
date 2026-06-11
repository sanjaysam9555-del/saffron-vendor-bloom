## Goal
Stop the Filter + 5 view tabs from overlapping/clipping on mobile. Keep the segmented pill aesthetic, but let the row scroll horizontally with snap, and auto-scroll the active tab into view.

## Changes (single file: `src/routes/client.index.tsx`)

### 1. Row container
Currently the right-side container is `flex w-full ... sm:w-auto`, which forces all 6 controls to share 390px and clip.

Update to:
- Keep `Filter` button pinned on the left with `shrink-0` (so it never scrolls away).
- Wrap the view-toggle segmented control in a horizontally scrollable region.

```tsx
<div className="flex w-full shrink-0 items-stretch gap-1.5 sm:w-auto sm:gap-2">
  <button data-tour="filters-button" ... className="... shrink-0 lg:hidden">
    {/* Filter */}
  </button>

  {/* New scroll wrapper — mobile only behavior */}
  <div className="relative min-w-0 flex-1 sm:flex-none">
    <div
      data-tour="view-toggle"
      role="tablist"
      aria-label="View"
      className="no-scrollbar flex snap-x snap-mandatory items-stretch overflow-x-auto rounded-md border border-[var(--border)] bg-white text-[10px] leading-none sm:overflow-visible sm:text-xs"
    >
      {/* each tab gets: shrink-0 snap-start whitespace-nowrap, drop flex-1 */}
    </div>
    {/* subtle right-edge fade hint that more tabs exist (mobile only) */}
    <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--cream)] to-transparent sm:hidden" aria-hidden />
  </div>
</div>
```

### 2. Each tab button
- Remove `flex-1` (was forcing equal widths and causing the squeeze).
- Add `shrink-0 snap-start whitespace-nowrap`.
- Bump horizontal padding slightly so labels breathe (`px-2.5 py-1.5`).
- Keep current active/inactive styling and `data-tour` anchors untouched.

### 3. Auto-scroll active tab into view
Add a small effect after `view` state so the active tab scrolls into the visible region on mobile (and after the user changes view):

```tsx
useEffect(() => {
  const el = document.querySelector(
    `[data-tour="view-toggle"] [aria-selected="true"]`
  ) as HTMLElement | null;
  el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}, [view]);
```

### 4. Hide scrollbar utility
Add a tiny `.no-scrollbar` utility (Tailwind v4 `@utility` in `src/styles.css`) so the scroll affordance stays clean:

```css
@utility no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
```

## Out of scope
- No change to desktop layout (`sm:` and above keep current sizing).
- No change to which tabs exist, order, icons, or tour anchors.
- Filter button behavior unchanged.

## Files touched
- `src/routes/client.index.tsx` — row wrapper, tab classes, scroll-into-view effect.
- `src/styles.css` — `no-scrollbar` utility.
