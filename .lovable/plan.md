## Fix Instagram link duplication on vendor detail pages

### Bug

On both detail pages, the Instagram link is built as `https://instagram.com/${vendor.instagram_handle}`. When a vendor's stored handle is already a full URL (e.g. `https://www.instagram.com/magic_in_frames/`), the result is `https://www.instagram.com/https://www.instagram.com/magic_in_frames/`. The card components already normalize the handle, so they work — only the detail pages are broken.

### Fix

Add a single shared helper and use it everywhere an Instagram link/label is rendered.

**New file:** `src/lib/instagram.ts`
- `normalizeInstagramHandle(raw: string | null | undefined): string | null` — strips leading `@`, strips any `https?://(www.)?instagram.com/` prefix, drops trailing slash and querystring. Returns just the handle, or null.
- `instagramUrl(raw)` → `https://www.instagram.com/${handle}/` or null.
- `instagramDisplay(raw)` → `@handle` or null.

**Replace inline logic in:**
- `src/components/client/ClientVendorDetail.tsx` (line ~150) — use `instagramUrl` for `link`, `instagramDisplay` for `value`.
- `src/components/vendor/VendorDetail.tsx` (line ~134, and the copy/share line ~79) — same.
- `src/components/client/ClientVendorCard.tsx` (line ~59-75) — replace inline normalizer with the helper.
- `src/components/vendor/VendorCard.tsx` (line ~154-170) — same.

### Out of scope

- No data migration on existing `vendors.instagram_handle` rows (the helper handles both formats at render time).
- Website/portfolio links (separate field, not reported broken).