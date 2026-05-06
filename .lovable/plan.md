# Client Comments + Email Notifications — IN PROGRESS

## ✅ Completed in this turn

1. **Migration**: `project_vendor_comments` table created with RLS (clients insert/delete own, all clients on a project read, staff read/delete all). Added to `supabase_realtime` publication.
2. **Email infrastructure**: Set up via Lovable Cloud. Domain `notify.planwithsaffron.in` is pending DNS verification (user can monitor in Cloud → Emails). Queue, cron, and tables are live.
3. **Email packages installed**: `@lovable.dev/email-js`, `@lovable.dev/webhooks-js`, `@supabase/supabase-js`, `@react-email/components`, `react-email`.
4. **Transactional send/preview/unsubscribe routes scaffolded** under `src/routes/lovable/email/` and `src/routes/email/`. Fixed `renderAsync` → `render` and minor TS typing on the queue dispatcher.
5. **Two email templates created** with fixed recipient `info@saffronevents.in`:
   - `src/lib/email-templates/client-comment-notification.tsx`
   - `src/lib/email-templates/client-status-change-notification.tsx`
   - Registered in `src/lib/email-templates/registry.ts`.
6. **Server data**: `getProject` now returns `comment_count` per vendor.

## ⏳ Remaining work (next turn)

1. Apply the same `comment_count` aggregation to `getMyProject` (mirror the change made to `getProject`).
2. Add new server fns to `src/server/projects.functions.ts`:
   - `listProjectVendorComments({ project_id, vendor_id })` — staff or client w/ project access; returns rows + author display_name/email.
   - `addProjectVendorComment({ vendor_id, body })` — client-only; inserts row, then **best-effort** fires the `client-comment-notification` email.
   - `deleteProjectVendorComment({ id })` — client deletes own, staff deletes any.
   - Update `setMyVendorStatus` to compute previous status, upsert, then fire `client-status-change-notification` (skip if unchanged). Wrap email calls in try/catch so the user-facing action never fails on email errors.
3. Add `src/lib/email/notify-staff.ts` server-only helper that resolves project + client info and POSTs to `/lovable/email/transactional/send` with the user's JWT (already on the request).
4. New client lib: `src/lib/comments-api.ts` (typed wrappers around server fns).
5. New components:
   - `src/components/client/VendorCommentsThread.tsx` — used inside `ClientVendorDetail.tsx`; chronological list, post box, delete on own.
   - `src/components/admin/ProjectVendorCommentsPanel.tsx` — read-only drawer for admin (delete-any).
6. UI wiring:
   - `ClientVendorDetail.tsx`: render thread below quote/documents block.
   - `ClientVendorCard.tsx`: small "💬 N" pill when `comment_count > 0`.
   - `admin.projects.$id.tsx`: comments pill on each vendor row → opens admin panel.
   - `client.index.tsx` & admin route: realtime subscription on `project_vendor_comments` to invalidate query keys.
7. Add `comment_count?: number` to `ClientVendor` in `src/lib/project-types.ts`.

## Notes / risks

- Emails won't actually deliver until DNS for `notify.planwithsaffron.in` is verified. The pending state is shown in Cloud → Emails. Templates and triggers will work end-to-end as soon as DNS turns green; no further code change needed at that point.
- Recipient is hard-coded to `info@saffronevents.in` (per request). If multiple staff addresses are needed later, replace with a small `notification_recipients` config table.
- Pre-existing security linter warnings on `has_role`/`has_project_access` are not introduced by this migration; leaving as-is.

## Files changed so far

- new: `supabase/migrations/<timestamp>_project_vendor_comments…sql` (via migration tool)
- new: `supabase/migrations/<timestamp>_email_infra.sql` (via setup_email_infra)
- new: `src/routes/lovable/email/queue/process.ts`, `src/routes/lovable/email/transactional/{send,preview}.ts`, `src/routes/lovable/email/suppression.ts`, `src/routes/email/unsubscribe.ts`
- new: `src/lib/email-templates/{registry.ts,client-comment-notification.tsx,client-status-change-notification.tsx}`
- edited: `src/server/projects.functions.ts` (only `getProject` so far — `getMyProject` still pending)
- edited: `package.json` (new deps + pnpm.overrides.entities)
