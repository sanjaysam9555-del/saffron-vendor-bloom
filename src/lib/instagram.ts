/**
 * Normalize an Instagram handle that may be stored as:
 *   - "@handle"
 *   - "handle"
 *   - "https://instagram.com/handle"
 *   - "https://www.instagram.com/handle/"
 *   - "instagram.com/handle?igshid=..."
 * Returns just the handle (no @, no slashes, no query), or null.
 */
export function normalizeInstagramHandle(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const handle = raw
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .trim();
  return handle.length > 0 ? handle : null;
}

/**
 * Returns true if the value looks like a real Instagram handle once
 * normalized — letters/digits/dots/underscores only, 1-30 chars. Filters
 * out garbage like "drive.google.com" pasted into the handle field.
 */
export function isValidInstagramHandle(raw: string | null | undefined): boolean {
  const h = normalizeInstagramHandle(raw);
  if (!h) return false;
  return /^[a-zA-Z0-9._]{1,30}$/.test(h) && !h.includes("..");
}

export function instagramUrl(raw: string | null | undefined): string | null {
  const h = normalizeInstagramHandle(raw);
  return h ? `https://www.instagram.com/${h}/` : null;
}

export function instagramDisplay(raw: string | null | undefined): string | null {
  const h = normalizeInstagramHandle(raw);
  return h ? `@${h}` : null;
}
