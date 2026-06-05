# Fix: Client Instagram previews not loading

## Symptom

Clients see "No Instagram preview" (or skeletons) on every vendor card in `/client`, even though the DB shows their assigned vendors all have `status = 'ok'` rows in `vendor_instagram_previews` (verified: 20/20, 19/19, 17/17, 7/7 for the four current clients).

## Likely root cause

The bulk endpoint `getVendorInstagramPreviewsBulk` is either throwing on the server (so `useQuery` lands in error state, `data` stays `undefined`, every card resolves to `null` → empty-state strip) or returning `[]` from one of its early-return branches for client callers.

Three early-return branches in `src/lib/instagram-preview.functions.ts` could silently empty the response for a non-staff caller:

1. `requireUser()` throws → "You're not signed in." or "Your session expired." — would only happen if the `Authorization` header is missing/invalid on the request.
2. `projectIds.length === 0` after the `project_clients` lookup → client with no project link.
3. `allowedIds.length === 0` after the `project_vendors` lookup → no overlap between requested vendor IDs and the client's assigned vendors.

DB query confirms branches 2 and 3 should NOT trigger for current clients. That leaves the `requireUser` path (auth header) or an uncaught query error as the most likely culprit.

A secondary possibility: when the server fn throws, the UI swallows the failure (no toast, no retry indicator) so cards just look empty.

## Plan

### 1. Instrument and diagnose (no logic change first)

Add structured `console.log`/`console.error` statements to `getVendorInstagramPreviewsBulk` so we can see in `server-function-logs`:

- the resolved `userId`, `isStaff`
- requested vs allowed vendor ID counts
- the DB query error (if any) from the `vendor_instagram_previews` read

Reproduce in the preview by logging in as a client account, then inspect logs to identify which branch fires.

### 2. Apply the fix indicated by the logs

Likely fixes (pick based on logs, not all):

- **Auth header missing on client tab**: ensure `attachAuthToken` is awaiting the session before the first call. If `supabase.auth.getSession()` returns `null` on first paint (race with `AuthProvider`), the hook's `enabled` flag should also gate on `session?.access_token` rather than just `vendorIds.length`. Currently the client query in `client.index.tsx` waits for session before calling `getMyProject`, but `useInstagramPreviewsBulk` does not — it can fire before the token is hydrated.
- **`getClaims` rejecting the token**: fall back to `supabaseAdmin.auth.getUser(token)` if `getClaims` returns no `sub`.
- **Filter mismatch**: if logs show `allowedIds.length === 0` despite DB showing matches, the cause is likely a mismatch between requested IDs and stored IDs (case, whitespace, etc.) — normalise the comparison.

### 3. Surface failures so this doesn't go silent again

- Set `previewsLoading` to `true` while the query is in `error` state too, OR show a tiny inline "Couldn't load Instagram preview — retry" affordance instead of the dashed empty box, so future regressions are visible.
- Add a `retry: 2` and short backoff to the bulk query so transient network/auth races recover automatically.

### 4. Gate `useInstagramPreviewsBulk` on session readiness (preventive)

Update `useInstagramPreviewsBulk` to accept (or internally read) a `sessionReady` signal so the very first call never goes out without a bearer token. This matches the gating already applied to `getMyProject` in `client.index.tsx`.

## Files to touch

- `src/lib/instagram-preview.functions.ts` — diagnostic logs, possibly switch to `getUser` if `getClaims` proves flaky, harden empty-result paths.
- `src/hooks/use-instagram-previews.ts` — gate `useInstagramPreviewsBulk` on session readiness, add `retry`, surface error state via `isLoading || isError` semantics.
- `src/components/vendor/VendorInstagramPreview.tsx` (only if we want a visible error affordance instead of the silent empty state).

## Out of scope

- Re-scraping any previews (data is already in DB).
- Touching admin-side bulk path (admin previews already render — confirms server logic works for staff callers).
- Bundle/animation work from the previous turn.
