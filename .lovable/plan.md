## In-app notifications for client comments & status changes

Replace the broken email pipeline with an in-app notification center for staff (admin/employee). Triggered by the same events that currently call `notifyStaff` — new client comment, client status change.

### 1. Database

New table `staff_notifications`:
- `id uuid pk`
- `kind text` ('comment' | 'status_change')
- `project_id uuid`, `vendor_id uuid` (nullable for safety)
- `actor_user_id uuid` (the client who acted)
- `title text`, `body text` (denormalized snapshot: client name, vendor name, comment excerpt / old→new status)
- `metadata jsonb` (project name, wedding date, vendor category, etc. for rendering)
- `read_by jsonb` default `'{}'` — map of `user_id -> read_at` so each staff member tracks their own read state on a shared row
- `created_at timestamptz default now()`

RLS:
- Staff (admin/employee) SELECT all
- Staff UPDATE only the `read_by` field (or simpler: any update allowed for staff)
- INSERT only via SECURITY DEFINER server functions (no client-side insert policy)

Realtime: add `staff_notifications` to `supabase_realtime` publication so the bell badge updates live.

### 2. Server functions

In `src/server/projects.functions.ts`:
- Replace the `notifyStaff(...)` calls inside `addProjectVendorComment` and the client status change handler with a new internal helper `insertStaffNotification(...)` that uses `supabaseAdmin` to insert a row into `staff_notifications`.
- Remove (or keep but no-op) the email enqueue path for these two events. Auth/transactional infra stays in place for future use; we just stop calling it for comments/status.

New server functions in `src/server/notifications.functions.ts`:
- `listStaffNotifications({ limit, before })` — staff only, paginated, newest first
- `markNotificationRead({ id })` / `markAllRead()` — updates `read_by[auth.uid()]`
- `getUnreadCount()` — fast count for the bell badge

### 3. UI

- New `NotificationsBell` component in `src/components/admin/` — bell icon + unread count, opens a popover/sheet listing recent notifications. Each item links to `/admin/projects/{project_id}` (anchored to the vendor where applicable).
- Mount it in the admin top nav (alongside `UserMenu`) on every `/admin/*` route.
- Subscribe to `postgres_changes` on `staff_notifications` (INSERT) to bump the unread count and prepend new items in real time. Also `toast.info(...)` on new arrivals while a staff member has the admin open.
- "Mark all read" button at the top of the list.

### 4. Cleanup

- Leave Lovable Cloud email infrastructure (queue, templates, send log) untouched — it's still wired for other uses.
- Update `src/lib/notify-staff.server.ts` to be a thin wrapper that calls `insertStaffNotification` (so existing call sites keep working without touching every file).

### Out of scope

- Email delivery for these events (explicitly removed per user choice).
- Notifications for non-staff users.

### Technical notes

- Why `read_by` jsonb instead of a per-user `notification_reads` table: there are only a handful of staff users; jsonb keeps it simple and avoids an extra join. Easy to migrate later if staff count grows.
- Realtime subscription should be scoped on the client to `event: 'INSERT'` only to avoid noise from read-state updates.
