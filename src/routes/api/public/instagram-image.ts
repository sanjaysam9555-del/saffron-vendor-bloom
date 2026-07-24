import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
} as const;
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  Referer: "https://www.instagram.com/",
} as const;

function fallbackImage(reason: string): Response {
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"/>',
    {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Instagram-Image-Proxy": reason,
        ...CORS_HEADERS,
      },
    },
  );
}

function isAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function validVendorId(value: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validKind(value: string | null): value is "avatar" | "thumb" {
  return value === "avatar" || value === "thumb";
}

function cachedPrefix(vendorId: string, kind: "avatar" | "thumb", sourceUrl: string): string {
  return `${vendorId}/${kind}-${shortHash(sourceUrl)}`;
}

function cachedPath(vendorId: string, kind: "avatar" | "thumb", sourceUrl: string): string {
  return `${cachedPrefix(vendorId, kind, sourceUrl)}.jpg`;
}

async function cachedImageResponse(
  vendorId: string,
  kind: "avatar" | "thumb",
  sourceUrl: string,
): Promise<Response | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { INSTAGRAM_CACHE_BUCKET } = await import("@/server/instagram-image-cache.server");
  const exactPath = cachedPath(vendorId, kind, sourceUrl);
  let path = exactPath;
  const { data } = await supabaseAdmin.storage.from(INSTAGRAM_CACHE_BUCKET).download(path);
  let file = data;
  if (!file) {
    // Earlier cache writes kept the original extension, so the same hashed
    // image may exist as .webp/.avif/etc. Look it up before going upstream.
    const prefix = cachedPrefix(vendorId, kind, sourceUrl).split("/")[1];
    const { data: exactMatches } = await supabaseAdmin.storage
      .from(INSTAGRAM_CACHE_BUCKET)
      .list(vendorId, { limit: 10, search: prefix });
    const exact = exactMatches?.find((item) => item.name.startsWith(prefix));
    if (exact?.name) {
      path = `${vendorId}/${exact.name}`;
      const retry = await supabaseAdmin.storage.from(INSTAGRAM_CACHE_BUCKET).download(path);
      file = retry.data;
    }
  }
  if (!file) {
    // Last-resort visual continuity: if the signed source URL has already
    // expired but any image for this vendor/slot was cached before, use it
    // rather than returning the 1px blank fallback.
    const { data: slotMatches } = await supabaseAdmin.storage
      .from(INSTAGRAM_CACHE_BUCKET)
      .list(vendorId, { limit: 25, sortBy: { column: "updated_at", order: "desc" } });
    const slot = slotMatches?.find((item) => item.name.startsWith(`${kind}-`));
    if (slot?.name) {
      path = `${vendorId}/${slot.name}`;
      const fallback = await supabaseAdmin.storage.from(INSTAGRAM_CACHE_BUCKET).download(path);
      file = fallback.data;
    }
  }
  if (!file) return null;
  return new Response(file.stream(), {
    status: 200,
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Cache-Control":
        "public, max-age=604800, s-maxage=604800, immutable, stale-while-revalidate=86400",
      ...CORS_HEADERS,
      Vary: "Accept",
      "X-Instagram-Image-Proxy": "cache-hit",
    },
  });
}

export const Route = createFileRoute("/api/public/instagram-image")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const target = reqUrl.searchParams.get("url");
        const vendorId = reqUrl.searchParams.get("vendorId");
        const kind = reqUrl.searchParams.get("kind");
        if (!target) return fallbackImage("missing-url");

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return fallbackImage("invalid-url");
        }
        if (!isAllowed(parsed)) {
          return fallbackImage("host-not-allowed");
        }

        const canPersist = validVendorId(vendorId) && validKind(kind);
        if (canPersist) {
          const hit = await cachedImageResponse(vendorId, kind, parsed.toString());
          if (hit) return hit;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const upstream = await fetch(parsed.toString(), {
            signal: controller.signal,
            headers: FETCH_HEADERS,
          });

          if (!upstream.ok || !upstream.body) {
            return fallbackImage(`upstream-${upstream.status || "empty"}`);
          }

          const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
          if (!contentType.toLowerCase().startsWith("image/")) {
            return fallbackImage("not-image");
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              // Instagram CDN URLs are effectively content-addressed, so we
              // can keep them in browser + edge caches for a week.
              "Cache-Control":
                "public, max-age=604800, s-maxage=604800, immutable, stale-while-revalidate=86400",
              ...CORS_HEADERS,
              Vary: "Accept",
            },
          });
        } catch {
          return fallbackImage("fetch-failed");
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});
