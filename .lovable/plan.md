# Vendor Self-Signup — duplicate detection + success animation

Adds two refinements on top of the previously approved plan: server-side duplicate detection that blocks resubmission, and a polished success animation in place of the form on submit.

## What we'll build

### 1. Duplicate detection (server-side, authoritative)
Run inside the public submit endpoint **before** any insert / file upload, so duplicates never create a vendor row or upload files.

Checks against the `vendors` table (case-insensitive, trimmed):
- **Vendor name** — exact match (lowercased, trimmed).
- **Contact number** — match on digits-only form (strips spaces, dashes, parens, leading `+`/`0`/country code variants).
- **Email** — exact match on lowercased value (only if provided).
- **Instagram handle** — match after stripping `@`, URL prefix (`instagram.com/...`), and trailing slash, lowercased.
- **Website** — match on normalized hostname (strip protocol, `www.`, trailing slash, lowercased) — only if both sides have a value.

If any of these matches an existing vendor, the endpoint returns:
```json
{ "ok": false, "error": "duplicate", "field": "contact_number", "message": "A vendor with this contact number is already registered." }
```
HTTP status `409 Conflict`. We never leak the existing vendor's name or details.

### 2. Client-side feedback for duplicates
- The form maps the returned `field` to the matching input and shows an inline red error under that field (e.g. "This Instagram handle is already registered with us").
- A toast also surfaces the same message at the top.
- The form stays filled — vendor can edit the offending field and resubmit. No page reload.

### 3. Lightweight pre-check (optional UX polish)
On blur of `vendor_name`, `contact_number`, `email`, and `instagram_handle`, the form calls a tiny `GET /api/public/vendor-signup/check?field=...&value=...` that runs the same normalization + lookup and returns `{ exists: true|false }`. This warns the vendor immediately ("This number is already on file") instead of waiting for submit.

This endpoint:
- Is public, rate-limited per IP (e.g. 30 req/min per Worker instance).
- Never returns vendor identity — only `exists`.
- Is purely advisory; the authoritative check still happens on submit.

### 4. Success animation (no reload, form replaced)
When the submit succeeds, the form's container animates out and a success card animates in **in place** — no navigation, no reload, scroll position preserved.

Visual:
- Centered circle with the brand cream background and a terracotta border.
- Animated SVG checkmark: the circle's `stroke-dashoffset` animates from full to 0 over ~500 ms (draws the ring), then the checkmark path draws over ~350 ms with the same technique, ending with a soft scale bounce.
- Below: "Thanks for reaching out!" headline (`font-display`) and a short line: "We've received your details and our team will be in touch shortly."
- Two actions: **Submit another vendor** (resets to a blank form, re-mounts with `key`) and **Back to homepage** (link to `/`).

Implementation:
- Pure CSS / SVG — no extra dependencies. Uses existing keyframes (`fade-in`, `scale-in`) plus two new ones for the stroke draw (`@keyframes draw-circle`, `@keyframes draw-check`) added to `src/styles.css`.
- The success card uses `animate-scale-in` on mount; the SVG strokes animate via CSS `animation-delay` so the ring draws first, then the tick.
- The form container uses `animate-fade-out` then unmounts; React conditional render swaps to `<SuccessCard />`.
- `prefers-reduced-motion: reduce` short-circuits all stroke animations to "show final state immediately" so we don't hurt accessibility.

## Technical details

### New / changed files
- `src/routes/api/public/vendor-signup.ts` — add duplicate check before insert; new GET sibling for the field-level pre-check.
- `src/routes/vendor-signup.tsx` — handle `409` response, render inline field error + toast, swap to success card on `200`, add blur-based pre-check calls.
- `src/components/vendor/VendorSignupSuccess.tsx` (new) — the animated checkmark + copy + actions.
- `src/styles.css` — append two keyframes (`draw-circle`, `draw-check`) and a `.vendor-success-check` class that wires `stroke-dasharray` / `stroke-dashoffset` and `animation-delay`. Wrap in `@media (prefers-reduced-motion: reduce)` to disable.

### Normalization helpers (server, shared)
A small `src/server/duplicate-detection.ts` module exporting:
- `normalizePhone(s)` → digits only, last 10 digits.
- `normalizeInstagram(s)` → handle without `@`, without URL, lowercased.
- `normalizeWebsite(s)` → hostname only, lowercased, no `www.`.
- `normalizeEmail(s)` → trim + lower.
- `findDuplicate(vendor) -> { field, message } | null` — runs the lookups in priority order (name → phone → email → instagram → website) and returns the first match.

The same module is used by both the submit handler and the pre-check endpoint to keep behaviour consistent.

### Edge cases
- Empty/whitespace values are skipped — we don't flag two vendors as "duplicates" because they both left email blank.
- The check is case-insensitive and ignores common formatting differences (so "+91 98765 43210" matches "9876543210").
- Existing vendors created by staff are also part of the dedup pool — vendors can't re-add themselves if staff already onboarded them.

## Out of scope (intentionally)
- Fuzzy / Levenshtein name matching — high false-positive rate; we'll only do exact normalized matches.
- Telling the vendor *which* existing vendor they collided with (privacy).
- Captcha — still optional, only if spam appears.
