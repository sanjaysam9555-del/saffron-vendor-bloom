# Fix iPad "App" Logout + Add Live Updates

Two separate issues, both rooted in how the site behaves when installed to the iPad home screen.

## Problem 1 — Logged out every time the app reopens

**Why this happens**

iOS "Add to Home Screen" runs the site in standalone mode using a separate WebKit storage partition. The Supabase auth session is stored in `localStorage` (see `src/integrations/supabase/client.ts`). Two things break it on iPadOS:

1. iPadOS aggressively evicts `localStorage` for standalone web apps when the app is closed/backgrounded, especially under storage pressure or after ~7 days of inactivity (Intelligent Tracking Prevention). The session token gets wiped → user appears logged out.
2. Our manifest (`public/site.webmanifest`) has empty `name`/`short_name` and `display: standalone`, but no `start_url`, `scope`, or `id`. iOS treats reopens with an unstable identity, which compounds the storage-eviction issue.

**Fix**

- Switch Supabase auth storage from `localStorage` to a more durable wrapper that writes to **both `localStorage` and `IndexedDB`** (IndexedDB survives ITP eviction far better on iOS standalone). On read, fall back to IndexedDB if `localStorage` is empty, then mirror back into `localStorage`. This is implemented as a small custom `storage` adapter passed into `createClient({ auth: { storage } })`.
- Make sure `autoRefreshToken: true` and `persistSession: true` stay on (already set) and add `detectSessionInUrl: true` so any callback flows still work.
- Update `public/site.webmanifest` so iOS treats the installed app as a stable identity:
  - `name`: "Saffron Events"
  - `short_name`: "Saffron"
  - `start_url`: "/login"
  - `scope`: "/"
  - `id`: "/"
  - keep `display: standalone`
- Note for the user: existing installed iPad icons keep the old manifest baked in. After this ships, **remove the app from the home screen and re-add it** so the new manifest takes effect.

## Problem 2 — Dashboard doesn't reflect changes in real time

**Why this happens**

`useVendors()` is a plain `useQuery({ queryKey: ["vendors"] })` with `staleTime: 30_000` and `refetchOnWindowFocus: false` (root QueryClient). Nothing pushes updates from the database, and the window-focus refetch that would normally rescue it is disabled. When a teammate adds/edits/deletes a vendor on another device, this iPad never finds out until a hard refresh.

**Fix** (two complementary layers)

1. **Supabase Realtime subscription on `vendors`**
   - Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;` (and `submissions` + `client_projects` if we want those live too — confirmed needed for admin views).
   - In `useVendors()`, add a `useEffect` that subscribes to `postgres_changes` on the `vendors` table and calls `queryClient.invalidateQueries({ queryKey: ["vendors"] })` on any INSERT/UPDATE/DELETE. Subscription is torn down on unmount.

2. **Re-enable focus / reconnect refetching as a safety net** (Realtime can drop on iOS when the app is backgrounded):
   - Set `refetchOnWindowFocus: true` and `refetchOnReconnect: true` on the root `QueryClient`.
   - Add a small `visibilitychange` listener inside `useVendors` that invalidates the vendors query when the tab becomes visible again — this is what guarantees the iPad sees fresh data the moment the user reopens the app.

## Files to change

- `src/integrations/supabase/client.ts` — custom `storage` adapter (localStorage + IndexedDB mirror), add `detectSessionInUrl: true`.
- `public/site.webmanifest` — fill in `name`, `short_name`, `start_url`, `scope`, `id`.
- `src/routes/__root.tsx` — flip `refetchOnWindowFocus` / `refetchOnReconnect` to `true`.
- `src/hooks/useVendorData.ts` — add Realtime subscription + `visibilitychange` invalidation inside `useVendors()`.
- New migration — add `vendors` (and optionally `submissions`, `client_projects`) to `supabase_realtime` publication.

## What the user should do after deploy

1. On the iPad, **remove** the existing Saffron app icon from the home screen.
2. Open the site in Safari and **Add to Home Screen again** so the updated manifest is picked up.
3. From then on, sessions should persist across reopens, and vendor changes from any device will appear within a second or two without manual refresh.

Approve and I'll implement.