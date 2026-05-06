## Problem

The vendor card on the **client board** still shows "No documents" even after a quote is added — quotes never feed into the card footer (only `vendor.attachments`). When the user opens the detail drawer, the quote shows up correctly (already wired via `getLatestProjectVendorQuote`).

The user also wants the **same treatment on the admin side** — but only inside the **Projects** area:
- the Projects list (`/admin/projects`)
- the specific project page (`/admin/projects/:id`)

The admin **Dashboard** stays untouched.

## Goal

Wherever a vendor appears in a project context, surface project-specific quote activity:
- "1st Quote Received", "2nd Quote Received", "3rd Quote Received", …
- "Revised (Nth Quote)" if the latest is a revision
- "Closed" (with amount on admin side) when a quote is finalised

## Implementation

### 1. Server: include quote summary per vendor

`src/server/projects.functions.ts`

- **`getMyProject`** (client) — also fetch `project_vendor_quotes` for the project, build a per-vendor summary, attach as `quote_summary` on each vendor:
  ```ts
  quote_summary: {
    count: number,
    latest_status: 'received' | 'revised' | 'closed' | 'withdrawn' | null,
    has_closed: boolean,
    closed_amount: number | null,
  }
  ```
- **`getProject`** (admin specific project) — same addition on each vendor row.
- **`listProjectsOverview`** (admin Projects list) — for each project, also return a small aggregate so the project card can show a meaningful summary:
  ```ts
  quotes_summary: {
    total_quotes: number,
    vendors_with_quotes: number,
    closed_count: number,
  }
  ```

All three use a single `select id, project_id, vendor_id, status, is_final, closed_amount, created_at` query per scope (no N+1).

### 2. Types

- `src/lib/project-types.ts` — add `quote_summary` to `ClientVendor`.
- Inside `getProject` / `listProjectsOverview` the admin pages already use `any` typing for vendors / projects, so no breaking change; new fields just flow through.

### 3. UI changes

**Client vendor card** — `src/components/client/ClientVendorCard.tsx`
- Replace the "No documents / N documents" footer with a **quote pill** built from `vendor.quote_summary`:
  - 0 quotes → no pill (or faint "—"; drop the noisy "No documents").
  - `has_closed` → green "Closed" pill.
  - `latest_status === 'revised'` → "Revised · Nth Quote".
  - else → "1st Quote Received", "2nd Quote Received", …
- Keep a tiny doc indicator only if `vendor.attachments.length > 0` (icon + count, no "No documents" text).
- Add an inline `ordinal(n)` helper.

**Admin specific project (`/admin/projects/:id`) — list view card**
`src/routes/admin.projects.$id.tsx`
- The existing `VendorQuotesPill` already shows "N quotes" / "Closed". Update its label logic to match the new wording so both sides feel consistent:
  - 0 → "Add quote" (unchanged, this is the action affordance).
  - 1 → "1st Quote Received" · 2 → "2nd Quote Received" · …
  - If latest is revised → "Revised · Nth Quote".
  - Closed → green "Closed · ₹X" (keep amount on admin side).
- Keep the small paperclip + file count badge on the right.
- (No change to the grouped view for this turn.)

**Admin Projects list (`/admin/projects`)**
`src/routes/admin.projects.index.tsx`
- Under the existing "N vendors · M client logins" line on each project card, add a small quote summary line driven by `quotes_summary`:
  - "M / N vendors quoted · K closed" when `total_quotes > 0`.
  - Hidden when `total_quotes === 0`.
- Style: same tiny `text-[11px] text-[var(--charcoal)]/55` row, to keep the card calm.

**Admin Dashboard** — untouched.

### 4. Realtime — keep cards in sync

- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE project_vendor_quotes;` (and `project_vendor_quote_files`).
- Client board (`src/routes/client.index.tsx`): subscribe to `postgres_changes` on `project_vendor_quotes` filtered by current `project_id` and invalidate `["my-project"]` + `["client-vendor-quote", projectId, vendorId]`.
- Admin specific project (`src/routes/admin.projects.$id.tsx`): subscribe to `postgres_changes` filtered by `project_id` and invalidate `["project", id]` + `["project-vendor-quotes", id, vendorId]`.
- Admin Projects list (`src/routes/admin.projects.index.tsx`): subscribe to all `project_vendor_quotes` changes (no project filter) and invalidate `["projects"]`. This is fine — the query is small and the table is low-write.

All three subscriptions clean up in `useEffect` return.

## Files changed

- `src/server/projects.functions.ts` — quote summaries on `getMyProject`, `getProject`, `listProjectsOverview`.
- `src/lib/project-types.ts` — add `quote_summary` to `ClientVendor`.
- `src/components/client/ClientVendorCard.tsx` — new quote pill, drop "No documents".
- `src/routes/client.index.tsx` — realtime subscription + invalidation.
- `src/routes/admin.projects.$id.tsx` — update `VendorQuotesPill` wording, realtime subscription.
- `src/routes/admin.projects.index.tsx` — show quote summary line on project cards, realtime subscription.
- New migration: enable realtime publication on quote tables.

## Out of scope

- Admin Dashboard (`/admin`) — explicitly unchanged per request.
- Grouped view on the project page — no change this turn.
- Closed amount on the **client** card — kept inside the drawer only; the card just says "Closed".
