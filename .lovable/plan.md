# Fix doubled Instagram URL on admin project vendor cards

## Problem
On `/admin/projects/:id`, the assigned-vendor card builds the Instagram link by hand:

```ts
const handle = v.instagram_handle.replace(/^@/, "");
href={`https://instagram.com/${handle}`}
```

When `instagram_handle` is stored as a full URL (e.g. `https://instagram.com/foo` or `instagram.com/foo/`), this only strips a leading `@`, so the final href becomes `https://instagram.com/https://instagram.com/foo` and the link does nothing. The rest of the app already routes through `src/lib/instagram.ts` (`instagramUrl`, `normalizeInstagramHandle`, `instagramDisplay`) which handles all stored formats.

## Fix
Edit `src/routes/admin.projects.$id.tsx` around lines 726–740:
- Import `instagramUrl` and `normalizeInstagramHandle` from `@/lib/instagram` (add to the existing import if not already present).
- Replace the manual handle/URL construction with:
  - `const handle = normalizeInstagramHandle(v.instagram_handle);`
  - `const href = instagramUrl(v.instagram_handle);`
  - Guard with `if (!handle || !href) return;` (or skip pushing the item) so we don't render a broken link when the value can't be parsed.
  - Use `href` for the `<a>` and `@{handle}` for the visible label, matching the existing card UI.

No other behavior, styling, or business logic changes.
