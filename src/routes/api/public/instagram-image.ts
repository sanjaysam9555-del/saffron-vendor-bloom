import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

function isAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

export const Route = createFileRoute("/api/public/instagram-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const target = reqUrl.searchParams.get("url");
        if (!target) return new Response("Missing url", { status: 400 });

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (!isAllowed(parsed)) {
          return new Response("Host not allowed", { status: 403 });
        }

        try {
          const upstream = await fetch(parsed.toString(), {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              Referer: "https://www.instagram.com/",
            },
          });

          if (!upstream.ok || !upstream.body) {
            return new Response("Upstream error", { status: 502 });
          }

          const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
          if (!contentType.startsWith("image/")) {
            return new Response("Not an image", { status: 415 });
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              // Instagram CDN URLs are effectively content-addressed, so we
              // can keep them in browser + edge caches for a week.
              "Cache-Control":
                "public, max-age=604800, s-maxage=604800, immutable, stale-while-revalidate=86400",
              "Access-Control-Allow-Origin": "*",
              "Cross-Origin-Resource-Policy": "cross-origin",
              Vary: "Accept",
            },
          });
        } catch {
          return new Response("Fetch failed", { status: 502 });
        }
      },
    },
  },
});
