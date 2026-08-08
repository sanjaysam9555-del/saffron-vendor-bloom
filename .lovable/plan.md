# Mobile PWA chrome: tighter top, uncut tab bar

Two presentation fixes for the installed iPhone app. No data or logic changes.

## What's wrong

**Top** — the mobile top bar sits below the full notch inset and is a fixed 56px tall on top of that, so there's a wide empty cream band between the status bar and the "Saffron / Dashboard" row.

**Bottom** — the tab bar is a fixed 64px tall *including* the home-indicator safe-area padding (border-box), so the padding eats into the row: icons and labels get pushed up and clipped at the top edge. Page content padding (`pb-16`) also ignores the safe-area inset, so the last list row hides behind the bar.

## What changes

- Shrink the mobile top bar to 48px and trim the safe-area padding it adds, so the header rides closer to the notch while the status bar stays clear. Content top offset updates to match.
- Make the tab bar height auto: a 60px row plus the home-indicator inset added *below* it, so nothing is clipped.
- Increase tab icons from 18px to 21px (+~17%) and nudge label size/spacing so seven tabs still fit on a 393px screen without crowding.
- Add the safe-area inset to the page bottom padding so the last row clears the bar.

## Technical notes

- `src/components/admin/AdminSidebar.tsx`: top bar `h-14` -> `h-12`; tab bar `h-16` -> `min-h-[60px]` with `items-stretch` preserved; `Icon` `h-[18px] w-[18px]` -> `h-[21px] w-[21px]`; label `text-[9px]` kept with tighter `gap-0.5`.
- `src/components/client/ClientTopNav.tsx`: same header height change for parity.
- `src/styles.css`: `.app-header-safe` uses a reduced top inset (`max(0px, calc(env(safe-area-inset-top) - 8px))`); `.app-footer-safe` keeps `padding-bottom: env(safe-area-inset-bottom)` but the bar no longer has a fixed height.
- `src/routes/admin.tsx`: `pt-14` -> `pt-12`, `pb-16` -> `pb-[calc(60px+env(safe-area-inset-bottom))]`; per-page `pb-16` wrappers left as-is (they sit inside this container).
- Desktop (`lg:`) rendering is untouched.
