## Goal

Let a client mark each vendor with one of five statuses, visible and editable both on the vendor card (grid) and inside the detail dialog. Selection persists per client+vendor and syncs immediately.

Statuses: We like it, Shortlisted, Finalised, Rejected, Need to think about it.

## Database

New table `public.client_vendor_status`:
- `id` uuid PK
- `user_id` uuid (the client's auth user id)
- `vendor_id` uuid
- `status` enum `client_vendor_status_enum` with values: `like`, `shortlisted`, `finalised`, `rejected`, `thinking`
- `created_at`, `updated_at` timestamps + `touch_updated_at` trigger
- `UNIQUE (user_id, vendor_id)` so each client has at most one status per vendor

RLS:
- Clients can view, insert, update, delete their own rows (`user_id = auth.uid()`).
- Staff (admin/employee) can view all rows so future admin-side reporting is possible.

To clear a status, the client deletes the row.

## Server functions (`src/server/projects.functions.ts`)

1. `setMyVendorStatus({ vendor_id, status })`
   - Auth: `requireSupabaseAuth`; verify caller is a `client` and that the vendor is assigned to their project (reuse the existing `client_can_view_vendor` SECURITY DEFINER check or look it up directly).
   - If `status` is null → delete the row. Otherwise upsert on `(user_id, vendor_id)`.
2. Extend `getMyProject` to include `client_status` on each returned vendor:
   - After loading vendor rows, query `client_vendor_status` for `user_id = caller` and `vendor_id IN (vendorIds)`, build a map, attach `client_status` (string or null) to each vendor in the returned list.

## Type update

`src/lib/project-types.ts` — add to `ClientVendor`:
```
client_status: 'like' | 'shortlisted' | 'finalised' | 'rejected' | 'thinking' | null;
```

Add a shared `CLIENT_STATUS_OPTIONS` constant (label + value + accent color) in a new `src/lib/client-status.ts` so the card and detail use the same list and styling.

## UI

New component `src/components/client/ClientStatusSelect.tsx`:
- Native `<select>` (lightweight, works inside the card without portal/click-bubbling pain) styled to match the cream/terracotta theme.
- Shows current status with a small colored dot; placeholder "Set status" when null.
- On change calls a `useMutation` that:
  - Optimistically updates the `["my-project"]` query cache so the card reflects instantly.
  - Calls `setMyVendorStatus`.
  - On error rolls back and toasts.
- Includes a "Clear" option that sends `status: null`.

Integrate into:
- `ClientVendorCard` — placed in the bottom row (next to "View Details"), with `e.stopPropagation()` so picking a status doesn't open the detail dialog. Also show a small status pill near the title for quick scanning.
- `ClientVendorDetail` — full-width selector at the top of the detail body, beneath the header.

Both surfaces share the same component so the value stays in sync via the React Query cache.

## Notes

- `getMyProject` already returns the vendor list as a single payload; adding `client_status` keeps the payload self-contained — no second round trip on load.
- Optimistic cache updates make card and detail update simultaneously without refetching.
- Status colors will live in `client-status.ts` using existing CSS tokens (e.g. terracotta for "Finalised", muted for "Rejected") to stay on-brand.
