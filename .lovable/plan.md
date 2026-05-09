## Why things don't sync without reload

Realtime works on a per-table, per-screen basis. Two things must be true for a change made on device A to appear on device B without a refresh:

1. The table is in the `supabase_realtime` publication (so Postgres broadcasts changes).
2. The screen subscribes to that table and invalidates the right React Query cache when an event arrives.

Auditing the project, both pieces are partial today.

### Tables currently broadcasting
`vendors`, `categories`, `project_vendor_quotes`, `project_vendor_quote_files`, `project_vendor_comments`.

### Tables NOT broadcasting (root cause of most "stale" bugs)
- `projects` — new/edited projects don't appear in the admin list, project header doesn't update.
- `project_vendors` — when an admin assigns or removes a vendor on a project, neither the admin project page nor the client portal updates.
- `client_vendor_status` — when one client/admin changes a status, other open sessions don't see it.
- `project_clients` — added/removed clients don't appear live.
- `vendor_attachments` — newly uploaded vendor files don't appear in open detail panels.

### Screens missing subscriptions even where the table broadcasts
- `admin.projects.index` — only listens to quotes; needs `projects`, `project_vendors`, `project_clients`.
- `admin.projects.$id` — only listens to quotes; needs `projects` (this row), `project_vendors`, `project_clients`, `client_vendor_status`, `vendors` (assigned vendor edits).
- `client.index` — listens to quotes + comments; needs `project_vendors` (assignments) and `client_vendor_status` (other clients).
- Vendor detail panels — no subscription to `vendor_attachments`.

## Plan

### 1. Database migration — add missing tables to realtime
```sql
ALTER TABLE public.projects            REPLICA IDENTITY FULL;
ALTER TABLE public.project_vendors     REPLICA IDENTITY FULL;
ALTER TABLE public.client_vendor_status REPLICA IDENTITY FULL;
ALTER TABLE public.project_clients     REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_attachments  REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.projects,
  public.project_vendors,
  public.client_vendor_status,
  public.project_clients,
  public.vendor_attachments;
```

### 2. Create a small reusable hook `useRealtimeInvalidate`
`src/hooks/useRealtimeInvalidate.ts` — takes an array of `{ table, filter?, queryKeys: string[][] }` and wires up one Supabase channel that invalidates all listed query keys on any change. Replaces the ad-hoc `useEffect` blocks in each route, keeps subscription logic consistent, and prevents leaks.

### 3. Wire subscriptions into the screens that need them
- `src/routes/admin.projects.index.tsx` — subscribe to `projects`, `project_vendors`, `project_clients` → invalidate `["admin-projects"]` and the existing quote keys.
- `src/routes/admin.projects.$id.tsx` — subscribe to `projects` (filter `id=eq.$id`), `project_vendors` (filter `project_id=eq.$id`), `project_clients` (same filter), `client_vendor_status`, plus `vendors` for inline vendor edits → invalidate `["admin-project", id]`.
- `src/routes/client.index.tsx` — extend the existing channel with `project_vendors` (filter `project_id=eq.$projectId`) and `client_vendor_status` → invalidate `["my-project"]`.
- `src/components/vendor/VendorDetail.tsx` — subscribe to `vendor_attachments` filtered by `vendor_id` while open → invalidate the file list query.

### 4. Tighten React Query freshness so refetches happen
Currently several queries inherit defaults that may serve stale data even after invalidation if the tab is backgrounded. In `src/router.tsx` (or wherever the QueryClient is created), set:
- `refetchOnWindowFocus: true`
- `refetchOnReconnect: true`
- `staleTime: 0` for the invalidation-driven queries (or rely solely on invalidate, which we already do).

This catches the iPad-PWA-resume case in addition to live edits.

### 5. Verify
- Open admin in one tab and client portal in another; assign a vendor → it appears live on client.
- Change a client status from the client side → admin project page reflects it.
- Edit a project name → admin list and detail header both update.
- Upload a vendor attachment → open detail panel shows it without reload.

### Out of scope
- Offline queueing of mutations.
- Presence/typing indicators.
- Reworking optimistic-update logic that already exists in `useSetVendorStatus`.

## Summary
Add 5 tables to the realtime publication, introduce a shared `useRealtimeInvalidate` hook, wire missing subscriptions on the admin projects list, admin project detail, client portal, and vendor detail screens, and turn on focus/reconnect refetch on the QueryClient.