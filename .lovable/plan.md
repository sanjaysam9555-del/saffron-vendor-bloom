# Client Comments + Email Notifications

Two related features:

1. A **comment thread** on each vendor card in a client's project. Comments are written by the client, shown chronologically, and visible both in the client's vendor detail drawer and in the admin's project → vendor view.
2. **Email notifications** to `info@saffronevents.in` whenever (a) a client adds a comment, or (b) a client changes a vendor's status.

---

## 1. Database

New migration:

- `project_vendor_comments` table:
  - `id uuid pk default gen_random_uuid()`
  - `project_id uuid not null` (the project the comment belongs to)
  - `vendor_id uuid not null`
  - `user_id uuid not null` (the client author)
  - `body text not null` (1–2000 chars; validated server-side)
  - `created_at timestamptz default now()`
  - index on `(project_id, vendor_id, created_at)`
- RLS:
  - Clients can `INSERT` only when `user_id = auth.uid()` AND they have `has_project_access(auth.uid(), project_id)` AND the vendor is in that project.
  - Clients can `SELECT` rows for projects they have access to (so they see their own previous comments, and so we can later allow co-clients on the same project to read each other's comments — useful for couples sharing one project).
  - Clients can `DELETE` / `UPDATE` only their own rows (optional; we'll expose delete only).
  - Staff (admin/employee) can `SELECT` all and `DELETE` any (no insert from staff side — comments are client-authored only).
- Add `project_vendor_comments` to the `supabase_realtime` publication so the admin view live-updates.

## 2. Server functions (`src/server/projects.functions.ts`)

- `listProjectVendorComments({ project_id, vendor_id })` — staff or client with project access. Returns rows joined with author display_name + email (resolved via `profiles` + `auth.admin.listUsers`, same pattern already used in `getProject`).
- `addProjectVendorComment({ vendor_id, body })` — client-only (uses `requireClientUser`). Resolves the client's project via `project_clients`, validates vendor is in that project, inserts the row, then **enqueues a notification email** (see §4).
- `deleteProjectVendorComment({ id })` — client can delete own; staff can delete any.

Update `setMyVendorStatus` (already exists) to additionally enqueue a status-change email after a successful upsert/delete (skip if status is unchanged — we'll re-read the previous value and short-circuit).

Update `getMyProject` and `getProject` to also return per-vendor `comment_count` so the card can show a badge without an extra round-trip.

## 3. UI

### Client side — `ClientVendorDetail.tsx`

Add a new "Comments" section below the quote/documents block:

- Lists existing comments oldest → newest with author name and relative timestamp.
- Shows a textarea + "Post comment" button (disabled while sending; toast on error).
- Trash icon next to the user's own comments.
- Uses React Query (`["project-vendor-comments", projectId, vendorId]`) with realtime subscription on `project_vendor_comments` (filter by `project_id`) to keep multiple devices/tabs in sync.

### Client card — `ClientVendorCard.tsx`

Add a small "💬 N" pill next to the existing "N docs" indicator when `comment_count > 0`, so clients see at a glance which vendors they've already commented on.

### Admin side — `admin.projects.$id.tsx`

In the vendor list (the "list" view) under each vendor row:

- Add a "💬 N comments" pill that, when clicked, opens a small read-only drawer (new component `ProjectVendorCommentsPanel.tsx` mirroring the styling of `ProjectVendorQuotesPanel`) showing the chronological thread with author + timestamp.
- Admins cannot post (read-only) but can delete any comment.
- Subscribes to realtime so new client comments appear without refresh.

## 4. Email notifications

Both new-comment and status-change notifications go to a fixed address: `info@saffronevents.in`.

**Setup (autonomous, no user action needed beyond the email-domain dialog):**

1. Check email-domain status. If no Lovable email domain is configured, show the email-setup dialog so the user can configure the sender domain (one-time).
2. Set up email infrastructure (queue, tables, cron).
3. Scaffold transactional emails and create two templates in `src/lib/email-templates/`:
   - `client-comment-notification.tsx` — subject: "New comment from {clientName} on {vendorName}". Body shows project (bride & groom), vendor, client, comment body, and a deep link to the admin project page.
   - `client-status-change-notification.tsx` — subject: "{clientName} marked {vendorName} as {status}". Body shows project, vendor, client, previous status → new status, and the same deep link.
4. Register both in `src/lib/email-templates/registry.ts`.
5. Create `src/lib/email/send.ts` helper.
6. Because clients are signed in (so the JWT is present), the comment and status-change server functions can `fetch('/lovable/email/transactional/send', ...)` server-to-server with the service role key. We'll do this from inside the handler (best-effort: wrap in try/catch and log on failure so the user-facing action never fails because of email).
7. Idempotency keys: `comment-${commentId}` and `status-${userId}-${vendorId}-${updatedAtIso}`.

**Important:** The email is to a staff address, not to the client — so it's a one-to-one transactional email triggered by a specific user action (comment posted / status changed). This fits the transactional email rules.

If the user prefers, we can later add an admin UI to toggle/recipient list, but for v1 the recipient is hard-coded to `info@saffronevents.in`.

## Files to add / edit

- New migration: `project_vendor_comments` + RLS + realtime publication.
- New server fns in `src/server/projects.functions.ts` (list/add/delete + email triggers).
- Update `setMyVendorStatus` to send status-change email.
- New client lib: `src/lib/comments-api.ts` (typed wrappers).
- New components:
  - `src/components/client/VendorCommentsThread.tsx` (used inside ClientVendorDetail).
  - `src/components/admin/ProjectVendorCommentsPanel.tsx`.
- Edit: `src/components/client/ClientVendorDetail.tsx`, `ClientVendorCard.tsx`, `src/routes/admin.projects.$id.tsx`, `src/routes/client.index.tsx` (realtime subscription), `src/lib/project-types.ts` (add `comment_count`).
- New email templates + registry update + `src/lib/email/send.ts` + email infra setup.

## Out of scope

- Threaded replies, reactions, mentions, attachments inside comments.
- Email digesting/throttling — every comment and every status change sends one email. Can add batching later if volume gets high.
- Notifying clients (only staff get emailed).

## Open question

Recipient is hard-coded to `info@saffronevents.in`. If you'd like multiple staff addresses or a configurable list, say so before approval and I'll add a small `notification_recipients` config table instead.
