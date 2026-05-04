## 1. Brand splash / loading screen — unified across the app

Currently three different loading states exist:

- `RouteProgress` — small pulsing logo at the top of the page (route transitions)
- `index.tsx` Splash — pulsing logo on cream
- `AuthGate` / `ClientGate` / `client.index.tsx` — plain "Loading…" text

Replace all of them with a single full-screen branded splash:

- **Background**: solid terracotta (`var(--terracotta)`) — the primary brand colour
- **Content**: the Saffron logo image, centred horizontally and vertically, with the wordmark "Saffron Planning Studio" beneath it in cream serif (Cormorant Garamond)
- **Animation**: existing `saffron-pulse` keyframe slowed by 40% — change duration from `1.2s` to `2s`
- **No "Loading…" text** anywhere
- **Position**: `fixed inset-0 z-[100] flex items-center justify-center` so it fully covers the dashboard / underlying UI (fixes "dashboard visible behind splash" bug)

### Where it gets used

Create `src/components/BrandSplash.tsx` (the single source of truth) and use it in:

- `src/components/RouteProgress.tsx` — replace the small top-bar logo with `<BrandSplash />` while a route is loading (keep the 120ms debounce and 6s safety timeout so instant transitions don't flash it)
- `src/routes/index.tsx` — replace the inline `Splash` with `<BrandSplash />`
- `src/components/AuthGate.tsx` and `src/components/ClientGate.tsx` — replace the "Loading…" div with `<BrandSplash />`
- `src/routes/client.index.tsx` — replace the "Loading…" fallback with `<BrandSplash />`

### PWA / iPhone webapp cold-boot splash

iOS PWAs show a static splash image (not HTML) before JS boots. Update so the OS-level splash matches:

- `public/site.webmanifest`: set `"background_color": "#9F3822"` (terracotta) and `"theme_color": "#9F3822"`
- Add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` in `__root.tsx` head (already standalone-capable)
- Use the existing `android-chrome-512x512.png` as the apple-touch-icon (iOS scales it on the terracotta background)

This way the iOS launch background matches the in-app splash so there's no visible jump from OS splash → app splash.

### Slowing the pulse

In `src/styles.css`, change the `saffron-pulse` animation duration applied inline from `1.2s` to `2s` (40% slower). Keep the keyframe shape (scale 0.92→1, opacity 0.65→1).

---

## 2. Custom Categories not showing in dropdown / sidebar filter

### Root cause

`src/lib/categories.ts` stores custom categories, renames, and deletions in **`localStorage` only** (`saffron.customCategories`, `saffron.categoryRenames`, `saffron.deletedCategories`). Consequences:

- A custom category added on one device/browser is invisible everywhere else (different phone, different laptop, incognito, after cache clear).
- A vendor saved with that category will exist, but the category name will be missing from the Sidebar list and the VendorForm dropdown on any other session — so it can't be filtered or re-selected.
- Renames and deletes don't sync either.

### Fix — move category management into the database

**New table** `public.categories`:

```text
id           uuid pk default gen_random_uuid()
name         text not null unique
is_base      boolean not null default false   -- seeded built-ins
is_deleted   boolean not null default false   -- soft delete (so base ones can be hidden)
created_at   timestamptz default now()
updated_at   timestamptz default now()
```

- Enable RLS.
- Policy: any authenticated user can `SELECT`. Staff (`admin` or `employee`) can `INSERT` / `UPDATE`. Only `admin` can soft-delete.
- Seed it in the migration with the existing `BASE_CATEGORIES` list with `is_base = true`.
- `updated_at` maintained by existing `touch_updated_at()` trigger.

**Refactor `src/lib/categories.ts`**:

- Replace localStorage helpers with a TanStack Query hook `useAllCategories()` that selects from `categories` where `is_deleted = false`, ordered by name.
- `addCustomCategory(name)` → `insert` row, then `queryClient.invalidateQueries(["categories"])`.
- `renameCategory(old, new)` → `update categories.name` + bulk `update vendors set category = new where category = old` (already done) + invalidate.
- `deleteCategory(name)` → set `is_deleted = true` + reassign vendors to "Miscellaneous" + invalidate.
- Subscribe to a Supabase realtime channel on `categories` so changes appear instantly across open sessions/devices.
- Keep `BASE_CATEGORIES` exported only as a fallback used during the first render before the query resolves (prevents an empty dropdown flash).

**Consumers** (`VendorForm`, `BulkEditDialog`, `Sidebar`, `CategoryManager`) keep calling `useAllCategories()` — no API change for them. Once the mutation resolves, the dropdown and the left-panel filter list update automatically.

### One-time migration of any existing localStorage entries

Add a small client-side bootstrap (runs once per device on app load) that reads any existing `saffron.customCategories` entries, upserts them into the new `categories` table, then clears the localStorage key. This avoids losing categories users have already created on this device.

---

## Files to change

- `public/site.webmanifest` — terracotta background/theme colour
- `src/styles.css` — slow `saffron-pulse` to 2s
- `src/components/BrandSplash.tsx` — new
- `src/components/RouteProgress.tsx` — use BrandSplash full-screen
- `src/components/AuthGate.tsx`, `src/components/ClientGate.tsx` — use BrandSplash
- `src/routes/index.tsx` — use BrandSplash, remove inline Splash
- `src/routes/__root.tsx` — iOS PWA meta tags
- `src/routes/client.index.tsx` — replace "Loading…" with BrandSplash
- `src/lib/categories.ts` — DB-backed category store + realtime + one-time localStorage migration
- New Supabase migration — `categories` table, RLS, seed, trigger
