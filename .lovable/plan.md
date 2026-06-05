## Two-way comments + client notifications

Today, only clients post comments and only staff get notified. This adds staff replies, client-side notifications, and visual threading.

### 1. Comment posting (staff)
- Add a new server function `addStaffVendorComment({ project_id, vendor_id, body, parent_id? })` in `src/server/projects.functions.ts` that:
  - Requires staff (admin/employee) via existing role check.
  - Inserts into `project_vendor_comments` with the staff user_id.
  - Creates a `client_notifications` row for every client on the project (see #3).
- Update `addProjectVendorComment` (client) to optionally accept `parent_id` so a reply maps to its parent.
- Extend `listProjectVendorComments` response with `author_role` ("staff" | "client") and `parent_id`.

### 2. UI — single shared thread for staff + client
Update `src/components/client/VendorCommentsThread.tsx`:
- Always render the textarea (remove the read-only branch). When `readOnly` is true (admin view), it posts via the staff endpoint instead.
- Show staff comments with a distinct style (e.g. terracotta accent + "Saffron Team" label); client comments stay neutral.
- Add a "Reply" button under each comment. Replies render indented under their parent. Top-level "Post comment" still works for non-replies.
- Admin view in `admin.projects.$id.index.tsx` no longer passes `readOnly`; it passes `asStaff` so the component calls the staff endpoint.

### 3. Client notifications
New table `public.client_notifications` (user_id, project_id, vendor_id, kind: "staff_comment" | "staff_reply", title, body, metadata, read_at, created_at) with RLS so each user sees only their own rows, plus standard GRANTs.

Server functions in a new `src/server/client-notifications.functions.ts`:
- `listMyClientNotifications({ limit })`
- `markClientNotificationRead({ id })`
- `markAllClientNotificationsRead()`

Staff comment insert fans out one row per client on the project. If the comment is a reply to a specific client's comment, that client's notification is titled "Saffron replied to your comment"; others get "Saffron added a comment".

### 4. Client bell UI
New `src/components/client/ClientNotificationsBell.tsx` modeled on the admin bell:
- Bell icon with unread count in `ClientTopNav.tsx`.
- Realtime subscription on `client_notifications` filtered by `user_id`.
- Clicking an item navigates to the client vendor view for that vendor and marks it read.

### Out of scope
- Email notifications for clients (in-app only, matching the staff pattern).
- Editing comments.
- Threading deeper than one reply level.

### Technical notes
- `project_vendor_comments` gets a nullable `parent_id uuid` column (self-FK, on delete set null).
- Staff insert RLS policy already exists; no schema change needed for staff posting.
- Client notification fan-out runs inside the staff-post handler; if it fails we log and continue (same pattern as `insertStaffNotification`).
