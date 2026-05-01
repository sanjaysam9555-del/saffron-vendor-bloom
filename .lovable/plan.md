## Diagnosis

Good news: your site **already does SSR** (it's built on TanStack Start, not CRA). I confirmed by fetching the live HTML — the server returns a full document with `<title>`, meta tags, og: tags, and module preloads. So the SEO advice you received ("migrate to Next.js") is **incorrect for this stack**.

The real problem: the **visible body** that gets server-rendered is just the word `Loading…`. That's because `AuthProvider` starts with `loading: true` and every page (including the home page) renders a spinner until auth resolves. On the server there's no browser session to restore, so SSR always emits the spinner.

So Google sees:
- ✅ Correct title, description, og:image
- ❌ Body content: just "Loading…"

This is a content-visibility bug, not a framework bug.

## Plan

### 1. Stop blocking SSR on auth restoration

In `src/lib/auth.tsx`, change the initial `loading` state so it is only `true` while we are actively fetching the role for a known session — not as a global default.

- Initial state: `loading: false`, `session: null`.
- When `getSession()` resolves and finds a user → set `loading: true` and load the role.
- When `getSession()` resolves with no user → stay at `loading: false`.

Result: server-side render produces the "no session" branch, which renders the actual login form HTML — not a spinner.

### 2. Render the login form on the server

`src/routes/index.tsx` currently shows `Loading…` while `loading` is true. After step 1, the SSR branch will fall through to `<ClientLoginForm />` directly. The form has real content (heading, copy, fields) that crawlers can read.

Also remove the second post-login "Loading…" branch — replace it with a small `<ClientOnly>` wrapper so the redirect logic only runs on the client, and SSR always emits the form.

### 3. Add proper SEO content to the home route

Right now `/` is the client login. For SEO this is thin. Add a short SEO-friendly intro section above the login form (visible to crawlers, styled subtly for users) describing Saffron Events — what you do, who you serve. This gives Google indexable copy on the homepage.

Per-route head() is already correct; we'll just enrich the body.

### 4. Verify SSR output

After deploy, `curl https://planwithsaffron.in/` should return HTML containing the real login form markup and the new intro copy — not "Loading…".

## Files to change

- `src/lib/auth.tsx` — flip initial loading semantics (only loading while fetching a known user's role)
- `src/routes/index.tsx` — render login form during SSR; defer redirect logic to client
- `src/routes/login.tsx` and `src/routes/client.login.tsx` — same SSR-friendly treatment if they currently spin
- (optional) Brief SEO hero block above the login form on `/`

## What we will NOT do

- ❌ Migrate to Next.js — your stack already SSRs. The advice was based on assuming this is plain Vite/CRA.
- ❌ Add prerender.io — same reason; unnecessary cost and complexity.
- ❌ Touch the build pipeline.

## Out of scope (raise separately if you want)

- A real public marketing landing at `/` with hero, services, testimonials (right now `/` is purely the client login). If you want planwithsaffron.in to be a marketing site with the login moved to `/login`, that's a bigger restructure I can do as a follow-up.
