# Plan

Four small, focused fixes.

## 1. Auto-close mobile filter drawer on category click

**Files:** `src/components/vendor/Sidebar.tsx`, `src/components/client/ClientSidebar.tsx`

In each "All Vendors" and per-category button's `onClick`, after calling `onChange(...)`, also call `onMobileClose?.()` so the slide-over drawer dismisses immediately on mobile. Desktop sidebar passes no `onMobileClose`, so behavior there is unchanged. Location chips stay open (multi-select — closing on every tap would be annoying).

## 2. Admin users table scrollable on mobile

**File:** `src/routes/admin.users.tsx`

The page currently uses `px-6` on the outer wrapper, which clips the table's horizontal scroll inside a narrow inner `overflow-x-auto`. Fix:
- Move the horizontal padding off the outermost wrapper for the table area, or wrap the table in a full-bleed scroll container (`-mx-6` + `px-6` on the inner edges) so it can scroll edge-to-edge on mobile.
- Add `touch-pan-x` and `[-webkit-overflow-scrolling:touch]` style hints to the scroll container so iOS handles horizontal flick correctly.
- Keep `min-w-[640px]` on the table so columns don't squish.

## 3. Redesign Loading screen — text only, animated dots

**File:** `src/components/BrandSplash.tsx`

Strip the `<img>` logo entirely and the import for it. New layout, cream background unchanged:

- Centered "Saffron Planning Studio" wordmark in terracotta (display font, same size as today).
- Below it: "Wedding & Event Planning" subtitle (unchanged).
- When `showLoading` is true: render the word **"Loading"** followed by four dots, where one dot is highlighted at a time, cycling 1 → 2 → 3 → 4 → 1 (a "circuit" of dots). Implement with four `<span>` dots, each animated with the same keyframe (opacity / color from terracotta-soft → full terracotta → back) but with staggered `animation-delay` of `0s`, `0.2s`, `0.4s`, `0.6s` over a `1.2s` infinite loop. The keyframe `saffron-dot-cycle` is added to `src/styles.css`.
- When `showLoading` is false (PWA opening plate): render only the wordmark + subtitle, no "Loading" line, no dots — keeps the cold-boot plate calm.

No more pulse animation on a logo (logo is gone).

## 4. Verify everything still uses BrandSplash consistently

No changes — already used by `AuthGate`, `ClientGate`, `RouteProgress`, `routes/index.tsx`, `routes/client.index.tsx`. Removing the logo + adding dots applies everywhere automatically.

## Technical notes

- `src/styles.css`: add `@keyframes saffron-dot-cycle { 0%, 100% { opacity: 0.25 } 25% { opacity: 1 } }` and offset each dot via inline `style={{ animationDelay: '...' }}`.
- The four-dot "Loading...." string uses real `<span>.</span>` elements (not literal periods) so each can animate independently.
- Mobile drawer close: pass `onMobileClose` through to category buttons only — locations stay multi-select.
- Admin table: use `-mx-6 px-6 overflow-x-auto` pattern so the scroll viewport spans the full screen width on mobile, while content keeps padding.
