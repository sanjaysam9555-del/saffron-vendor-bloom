# Bulk Instagram Preview Backfill

Add a one-click backfill on the admin dashboard that fetches Instagram previews for every vendor that doesn't have one yet, or whose cached preview is older than 30 days. Vendors with fresh, successful previews are skipped so we don't waste Apify credits.

## How it works (user view)

1. Admin opens `/admin` and clicks a new **"Sync Instagram"** button in the top toolbar (next to view toggle / bulk mode).
2. A small dialog shows: total vendors with handles, how many are missing or stale, and a **Start backfill** button.
3. Clicking start kicks off the job. The dialog shows live progress (`Processed 23 / 117 — 4 errors`) and can be left open or closed; progress keeps running on the server.
4. When done, a toast confirms completion and the dashboard auto-refreshes the preview cache.

## Technical details

### New server function: `backfillInstagramPreviews`
- Location: `src/server/instagram-preview.functions.ts`
- Auth: staff-only (reuses `requireUser` + `isStaff` check).
- Input: `{ mode: "missing_or_stale" | "all", batchSize?: number }` (default 5).
- Logic:
  1. Query `vendors` for all rows with a non-null `instagram_handle`.
  2. Left-join `vendor_instagram_previews` to find vendors that are missing, errored, or have `fetched_at` older than 30 days.
  3. Process in batches of 5 sequentially (Apify run-sync is one profile per call today; batching keeps us under request timeouts and rate limits). Each handle goes through the existing `scrapeInstagramProfile` + `upsertPreview` pipeline.
  4. Returns `{ total, processed, ok, errors, skipped }`.

### Progress tracking
Use a lightweight `instagram_backfill_jobs` table:
- `id uuid pk`, `started_by uuid`, `status text` (`running|done|error`), `total int`, `processed int`, `ok int`, `errors int`, `started_at`, `updated_at`.
- The server function inserts a row, updates counters after each handle, sets `status=done` at the end.
- A second tiny server fn `getInstagramBackfillStatus(jobId)` returns the current row so the UI can poll every 2s.
- RLS: staff-only select/insert/update.

### UI
- New component `BulkInstagramSyncDialog.tsx` under `src/components/vendor/`.
- New hook in `src/hooks/use-instagram-previews.ts`: `useStartInstagramBackfill`, `useInstagramBackfillStatus(jobId)`.
- Add a `Sync Instagram` button to the admin toolbar in `src/routes/admin.index.tsx` (admin-only, hidden for employees if you want — defaults to staff).
- On success, invalidate `["instagram-previews-bulk"]` and `["instagram-preview"]` queries.

### Why batches of 5
Apify's `run-sync-get-dataset-items` is one profile per call and each profile can take 10-30s. Cloudflare Worker requests have a hard wall-clock limit, so we don't loop the entire vendor list inside a single request. Instead the client polls and the server fn is invoked once per batch (or we run a single long-running fn that updates the row as it goes — see "Execution model" below).

### Execution model — single call, server-side fire-and-forget
Use `waitUntil` semantics: the initial `backfillInstagramPreviews` call inserts the job row, kicks off processing via `ctx.waitUntil(processAll(jobId))`, and returns `{ jobId }` immediately. `processAll` iterates through handles, updating the job row after each. The UI polls `getInstagramBackfillStatus`. This keeps the worker request short while letting work continue in the background.

## Out of scope
- Scheduled / recurring auto-refresh (can be added later as a pg_cron job hitting the same backfill function).
- Selective backfill of a chosen subset of vendors (only "missing or stale" for now).
- Live per-vendor log in the UI — only aggregate counters.
