# Client Comments + Email Notifications — DONE

All wiring is in place:
- `project_vendor_comments` table + RLS + realtime
- Server fns: `listProjectVendorComments`, `addProjectVendorComment`, `deleteProjectVendorComment` in `src/server/projects.functions.ts`
- `setMyVendorStatus` now fires `client-status-change-notification` (only on actual change)
- `addProjectVendorComment` fires `client-comment-notification`
- Both emails go to `info@saffronevents.in` via the queued send route
- `getProject` and `getMyProject` now return `comment_count` per vendor
- Client UI: comment thread inside the vendor detail drawer; comment count chip on the vendor card
- Admin UI: "N comments / No comments" pill per vendor; opens a read-only thread with delete-any
- Realtime invalidation for `project_vendor_comments` on both sides

Pending (out of agent's hands): DNS verification for `notify.planwithsaffron.in`. Until then, sends are queued/logged but not delivered. Visible in Cloud → Emails.
