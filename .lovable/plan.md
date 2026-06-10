## 1. Instagram preview auto-refresh for newly added vendors

**Problem.** `VendorForm` already fires `triggerInstagramPreview()` after a vendor is created. The scrape returns and patches the bulk-preview React Query cache — but only under the cache key that was active *before* the new vendor existed. When the vendor list refreshes, a new query key (with the new vendor id in its sorted list) is created and fetched from the server, which returns no preview row yet (Apify is still running), so the new card renders empty. On the client side, the scrape never propagates either because clients don't share that cache.

**Fix.**
- In `useTriggerInstagramPreview` (`src/hooks/use-instagram-previews.ts`), after the scrape resolves, also call `qc.invalidateQueries({ queryKey: ["instagram-previews-bulk"] })` so the next bulk fetch picks up the freshly stored row for every currently mounted list (admin grid, table, board, client portal).
- In the admin vendor create flow, after the scrape returns, invalidate `["vendors"]` / the project-vendors list as well so the new card re-renders.
- Client side gets the new preview automatically via the existing realtime subscription on `vendors` + the bulk invalidation; no client-only code change needed.
- Add a short retry (one extra `ensureVendorInstagramPreview({ force: true })` after ~10s) for the case where Apify's first call returns `error`/`not_found` for a brand-new handle.

## 2. Client logged out when posting a vendor comment

**What we know.**
- The server fn `addProjectVendorComment` is gated by `requireClientUser`, which throws "Authentication is still loading…" when the bearer token is missing or `getUser(token)` errors.
- `attachAuthToken` reads `supabase.auth.getSession()`. If Supabase's silent token refresh failed (common on mobile after the tab is backgrounded), the request goes out with a stale token, the server returns an Error, and any subsequent `getSession`/`getUser` call resolves to "no user" — which our auth provider treats as signed out.
- There is no obvious "auto sign-out on 401" handler, so the symptom is most likely that the failed comment post races with an expired session and the next auth tick sets `session = null`.

**Fix.**
- In `attachAuthToken` (and the comment mutation path), call `supabase.auth.getUser()` first; if it returns a user but the access token is near expiry, call `supabase.auth.refreshSession()` and use the refreshed token. This stops the request from going out with a dead JWT.
- In `requireClientUser`, on a missing/invalid token return a typed `{ retry: true }` error message ("Your session refreshed — please try again.") instead of a plain Error string, so the mutation's `onError` shows a toast and does NOT trigger any downstream `signOut`.
- In `VendorCommentsThread`'s `post.onError`, never call `signOut()` (it doesn't today, but I'll add a guard) and surface a one-tap "Retry" toast.
- Add `console.warn` breadcrumbs on the client around: session expiry detection, comment mutation failure, and any `signOut()` call site (`auth.tsx`, `ClientTopNav`, `ClientGate`, `client.index.tsx`) tagged `[auth-debug]` so the next time it happens for the client we see the exact trigger in their browser logs.

## 3. Client Time tab — categories driven by admin

Per your answer: **only categories the admin has explicitly added a deadline/priority row for** appear in the client's Time tab (timeline + table).

**Admin workflow (unchanged shape, clearer UX).**
- Admin opens the project's Time tab → "Add category to plan" button → picks a category from the master list, sets due date, criticality, planned amount, optional notes, optional actual override.
- Each row is one `project_category_deadlines` record.
- Admin can remove a row to hide it from the client again.
- Admin still sees ALL categories that have assigned vendors (so they can compare planned vs assigned), but rows without a deadline record are flagged "Not visible to client yet".

**Client workflow.**
- Client Time tab fetches `project_category_deadlines` (already does).
- `buildTimelineItems` is changed to iterate over **deadlines first** (not assigned-vendor categories) for the client mode, and join in vendor count / booked status from `project_vendors`.
- A category with no vendors yet still shows with "0 vendors assigned" + planned amount + due date — useful pre-booking visibility.
- Categories with vendors but no deadline row are invisible to the client (today they appear with "No date set").

**No schema change required.** `project_category_deadlines` already stores due_date, criticality, planned_amount, actual_amount_override, notes. RLS already lets clients SELECT their own project's rows.

### Technical details (for reference)

Files touched:

```text
src/hooks/use-instagram-previews.ts          # invalidate bulk on trigger + retry
src/components/vendor/VendorForm.tsx         # invalidate vendors list after scrape
src/lib/auth-client-middleware.ts            # refresh near-expiry token before send
src/lib/projects.functions.ts                # addProjectVendorComment retry-friendly error
src/components/client/VendorCommentsThread.tsx  # no signOut on post error + retry toast
src/lib/auth.tsx, src/components/ClientGate.tsx, src/components/client/ClientTopNav.tsx,
src/routes/client.index.tsx                  # [auth-debug] breadcrumbs around signOut paths
src/lib/build-timeline-items.ts              # client mode: iterate deadlines, not vendor cats
src/components/timeline/VendorTimeline.tsx   # admin: badge rows missing from client view + "Add category to plan" CTA
src/routes/admin.projects.$id.index.tsx      # ensure admin Time tab passes mode + handlers
```

No migrations. No new tables. Realtime subscription on `project_category_deadlines` already exists on the client side.
