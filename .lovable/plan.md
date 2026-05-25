## Current state

Root `__root.tsx` already has a solid base: title, description, keywords, robots, theme-color, OG, Twitter, JSON-LD (`EventPlanningService` + `LocalBusiness`), favicons, and webmanifest. `robots.txt` and `sitemap.xml` exist and look fine. Favicons exist (`favicon.ico`, 16/32 PNG, apple-touch, android-chrome 192/512).

## Problems to fix

1. **Broken OG / JSON-LD images.** Root meta references `https://planwithsaffron.in/images/og-cover.jpg` and `https://planwithsaffron.in/images/logo.png`, but `public/images/` doesn't exist. Social previews and Schema.org logo currently 404.
2. **`og:image` on root layout.** TanStack concatenates the root's `og:image` into every leaf, so this is fine today (no leaf sets its own) but should be moved/duplicated to leaf for safety once we have real content routes. For now keep at root since `/` is the only public page.
3. **`/` (index) is missing OG and canonical.** It only sets title, description, og:url. No `og:title`, `og:description`, no `<link rel="canonical">`. `/vendor-onboarding` is missing canonical too.
4. **`apple-mobile-web-app-title`** is "Planning Studio" — should be "Saffron".
5. **Private surfaces missing `noindex`.** `/admin`, `/admin/projects`, `/admin/users`, `/client`, `/client/login`, `/login` all rely solely on `robots.txt` Disallow. Add `noindex, nofollow` meta on each (matches the pattern already used on `/admin/submissions` and `/vendor-signup`) so any accidentally-crawled URL stays out of the index.
6. **Webmanifest polish.** Missing `start_url: "/"`, `scope: "/"`, `id: "/"`, and `description`. Add them.
7. **Favicon SVG.** Optional but cheap: add a tiny `favicon.svg` link entry only if we generate one. Skip if not.

## Changes

### Assets

- Generate `public/og-cover.jpg` (1200×630, premium tier — text legibility matters) with "Saffron Planning Studio — Wedding & Event Planning Studio in India", saffron/terracotta brand palette, elegant typography matching the splash screen. Update root meta to point at `/og-cover.jpg` (drop the missing `/images/` path).
- Reuse `apple-touch-icon.png` for the JSON-LD logo by pointing it at `https://planwithsaffron.in/apple-touch-icon.png` (existing 180×180 brand mark) — no new asset needed.

### `src/routes/__root.tsx`

- Fix `og:image` and `twitter:image` URLs to `https://planwithsaffron.in/og-cover.jpg`.
- Fix JSON-LD `logo` to `https://planwithsaffron.in/apple-touch-icon.png`.
- Change `apple-mobile-web-app-title` to `"Saffron"`.

### `src/routes/index.tsx`

- Add `og:title`, `og:description`, and `<link rel="canonical">` for `https://planwithsaffron.in/`.

### `src/routes/vendor-onboarding.tsx`

- Add `<link rel="canonical">` for `https://planwithsaffron.in/vendor-onboarding`.

### Private routes — add `noindex, nofollow` meta

- `src/routes/admin.index.tsx`
- `src/routes/admin.projects.index.tsx`
- `src/routes/admin.projects.$id.tsx`
- `src/routes/admin.users.tsx`
- `src/routes/client.index.tsx`
- `src/routes/client.login.tsx`
- `src/routes/login.tsx` (already redirects to `/`, but add noindex meta in `head()` for safety)

`admin.submissions.tsx` and `vendor-signup.tsx` already have it — no change.

### `public/site.webmanifest`

Add `start_url`, `scope`, `id`, and `description` while preserving existing icons/theme.

### Sitemap & robots

No changes needed. Both already cover the two public routes (`/`, `/vendor-onboarding`) and disallow private surfaces. Will mark the existing failing accessibility/GSC findings appropriately afterwards (GSC stays failing — connecting Google Search Console is a user action).

## Out of scope

- Connecting Google Search Console (user must authorize).
- Lighthouse accessibility contrast finding (separate request — colors live in `src/styles.css`).
