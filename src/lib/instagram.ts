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

export function instagramUrl(raw: string | null | undefined): string | null {
  const h = normalizeInstagramHandle(raw);
  return h ? `https://www.instagram.com/${h}/` : null;
}

export function instagramDisplay(raw: string | null | undefined): string | null {
  const h = normalizeInstagramHandle(raw);
  return h ? `@${h}` : null;
}
