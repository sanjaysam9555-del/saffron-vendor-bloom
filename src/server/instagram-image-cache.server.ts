import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { InstagramScrapeResult } from "@/server/instagram-preview.server";

const BUCKET = "instagram-cache";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 10_000;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  Referer: "https://www.instagram.com/",
} as const;

const CACHE_HOST_RE = /(cdninstagram\.com|fbcdn\.net)/i;

/**
 * True if `url` is an Instagram CDN URL whose signature expires.
 * Cached URLs from our own storage proxy are stable and skip persistence.
 */
function looksEphemeral(url: string | null | undefined): boolean {
  if (!url) return false;
  return CACHE_HOST_RE.test(url);
}

function shortHash(input: string): string {
  // Cheap, stable, collision-safe-enough fingerprint for filenames.
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function extFromContentType(ct: string): string {
  const lower = ct.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("avif")) return "avif";
  return "jpg";
}

/** Public proxy URL — see src/routes/api/public/ig-asset.ts */
function publicUrlForPath(path: string): string {
  return `/api/public/ig-asset?path=${encodeURIComponent(path)}`;
}

/**
 * Download `sourceUrl` and upload it to the private `instagram-cache` bucket.
 * Returns the public proxy URL on success, or null on any failure (caller
 * should fall back to the original URL).
 */
export async function persistInstagramImage(
  vendorId: string,
  kind: "avatar" | "thumb",
  sourceUrl: string,
): Promise<string | null> {
  if (!sourceUrl || !looksEphemeral(sourceUrl)) {
    // Either nothing to persist or already a stable URL.
    return sourceUrl || null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
    });
    if (!res.ok || !res.body) {
      console.warn(
        `[ig-image-cache] upstream ${res.status} vendor=${vendorId} kind=${kind}`,
      );
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      console.warn(`[ig-image-cache] non-image content-type=${contentType}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      console.warn(
        `[ig-image-cache] size out of range bytes=${buf.byteLength} vendor=${vendorId}`,
      );
      return null;
    }
    const ext = extFromContentType(contentType);
    const path = `${vendorId}/${kind}-${shortHash(sourceUrl)}.${ext}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(buf), {
        upsert: true,
        contentType,
        cacheControl: "604800",
      });
    if (uploadErr) {
      console.error(
        `[ig-image-cache] upload failed vendor=${vendorId} kind=${kind}: ${uploadErr.message}`,
      );
      return null;
    }
    return publicUrlForPath(path);
  } catch (e) {
    console.warn(
      `[ig-image-cache] fetch/upload threw vendor=${vendorId} kind=${kind}: ${
        e instanceof Error ? e.message.slice(0, 200) : "unknown"
      }`,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Mirror the avatar and post thumbnails referenced in a scrape result into
 * the cache bucket. Returns a new scrape result with persisted URLs swapped
 * in; URLs we couldn't mirror are left as-is so the proxy fallback still has
 * a chance to render them.
 */
export async function persistInstagramAssets(
  vendorId: string,
  scrape: InstagramScrapeResult,
): Promise<InstagramScrapeResult> {
  if (scrape.status !== "ok") return scrape;

  const [avatarPersisted, ...thumbPersisted] = await Promise.all([
    scrape.avatar_url
      ? persistInstagramImage(vendorId, "avatar", scrape.avatar_url)
      : Promise.resolve(null),
    ...scrape.post_thumbnails.map((src) => persistInstagramImage(vendorId, "thumb", src)),
  ]);

  return {
    ...scrape,
    avatar_url: avatarPersisted ?? scrape.avatar_url,
    post_thumbnails: scrape.post_thumbnails.map(
      (src, i) => thumbPersisted[i] ?? src,
    ),
  };
}

/** Exposed so the proxy route can stream files without re-declaring the bucket name. */
export const INSTAGRAM_CACHE_BUCKET = BUCKET;
