import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
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

export const Route = createFileRoute("/api/public/instagram-image")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const target = reqUrl.searchParams.get("url");
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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const upstream = await fetch(parsed.toString(), {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              Referer: "https://www.instagram.com/",
            },
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
