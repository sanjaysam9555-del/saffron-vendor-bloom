import { createFileRoute } from "@tanstack/react-router";

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
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-IG-Asset-Proxy": reason,
        ...CORS_HEADERS,
      },
    },
  );
}

// Tight path guard: `{uuid}/{kind}-{hash}.{ext}`.
const PATH_RE = /^[0-9a-f-]{36}\/(?:avatar|thumb)-[a-z0-9]+\.(?:jpg|jpeg|png|webp|gif|avif)$/i;

export const Route = createFileRoute("/api/public/ig-asset")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        if (!path || !PATH_RE.test(path)) {
          return fallbackImage("invalid-path");
        }

        // Lazy import — keep the admin client out of the client bundle graph.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { INSTAGRAM_CACHE_BUCKET } = await import(
          "@/server/instagram-image-cache.server"
        );

        const { data, error } = await supabaseAdmin.storage
          .from(INSTAGRAM_CACHE_BUCKET)
          .download(path);

        if (error || !data) {
          return fallbackImage("not-found");
        }

        const contentType = data.type || "image/jpeg";
        return new Response(data.stream(), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control":
              "public, max-age=604800, s-maxage=604800, immutable, stale-while-revalidate=86400",
            ...CORS_HEADERS,
            Vary: "Accept",
          },
        });
      },
    },
  },
});
