## Diagnosis

Comment notifications (and every other transactional email this app tries to send) never make it past the in-Worker self-fetch.

What I found:
- `email_send_log` is **empty** — zero rows, ever. Every successful or failed send path inserts a row, so this proves the `/lovable/email/transactional/send` route has never actually run a send. It's not a comment-specific bug; status-change emails hit the same dead end.
- `addProjectVendorComment` (in `src/server/projects.functions.ts`) inserts the comment, then calls `notifyStaff(...)`.
- `notifyStaff` (in `src/lib/notify-staff.server.ts`) does `fetch(new URL("/lovable/email/transactional/send", req.url), ...)` — i.e. it's a server function on Cloudflare Workers asking the same Worker to handle a second HTTP request.
- That self-fetch is the failure: Cloudflare Workers cannot reliably `fetch()` their own deployment URL from inside a request handler. The call either errors or never resolves; either way the surrounding `try/catch` swallows it (`console.warn("comment email failed: …")`), so the user sees the comment saved but no email is sent and nothing useful surfaces in the UI.
- Email infrastructure itself is healthy: `enqueue_email` RPC exists, `email_send_state` is configured, suppression list is empty, and the templates (`client-comment-notification`, `client-status-change-notification`) are registered with a fixed `to: 'info@saffronevents.in'`.

So: the wire to the email queue is broken, not the queue itself, and not the comment code path specifically.

## Plan

Replace the Worker-internal HTTP hop with a direct in-process call so server functions enqueue emails the same way the route does.

### 1. Extract the send/enqueue logic into a shared server helper

New file: `src/lib/email/enqueue-transactional.server.ts`. Contents are exactly what the POST handler in `src/routes/lovable/email/transactional/send.ts` does today, minus the request parsing and JWT check:
- Look up the template from `TEMPLATES`.
- Resolve `effectiveRecipient` (template `to` overrides arg).
- Suppression check against `suppressed_emails`.
- Get-or-create unsubscribe token in `email_unsubscribe_tokens`.
- Render the React Email component to HTML + plain text.
- Insert `pending` row in `email_send_log`.
- Call `enqueue_email` RPC with the same payload shape (sender_domain, from, subject, html, text, idempotency_key, unsubscribe_token, etc.).
- Return `{ success, queued }` or `{ success: false, reason }`.

Export a single function, e.g.
`enqueueTransactionalEmail({ templateName, recipientEmail?, idempotencyKey?, templateData? })`.

It uses `supabaseAdmin` (service role) directly — no HTTP, no JWT — because every caller is already authenticated server-side.

### 2. Rewrite `src/lib/notify-staff.server.ts` to call the helper

Drop the `getRequestHeader` / `fetch` block entirely. The new body just delegates:

```text
notifyStaff({ templateName, templateData, idempotencyKey })
  → enqueueTransactionalEmail({ templateName, templateData, idempotencyKey })
```

Same try/catch-friendly contract (still throws on failure so callers' `console.warn` works), but now failures are real errors with messages instead of silently lost.

### 3. Make the HTTP route a thin wrapper around the helper

`src/routes/lovable/email/transactional/send.ts` keeps its current responsibilities — parse JSON, verify the Bearer token via Supabase auth — and then calls the same `enqueueTransactionalEmail(...)`. This guarantees the route and the in-process callers behave identically and there's a single source of truth for the enqueue pipeline.

### 4. Verify

- Post a comment as a client → check `email_send_log` for a `pending` row with `template_name = 'client-comment-notification'` and recipient `info@saffronevents.in`.
- Watch the queue dispatcher log/email_send_log status flip from `pending` → `sent`.
- Change a vendor status as a client → same row appears for `client-status-change-notification`.
- Confirm the inbox actually receives both.

### Out of scope

- No template, recipient, or domain changes.
- No change to the unsubscribe / suppression flow or the queue dispatcher.
- No new env vars or secrets.

## Summary
Replace the Worker self-`fetch` in `notifyStaff` with a direct in-process enqueue helper that both the `send-transactional-email` route and server functions reuse. This unblocks comment emails (and all other transactional emails, which were silently failing for the same reason).