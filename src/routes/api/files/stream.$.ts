import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyFileStreamToken } from "@/server/file-stream-token.server";

const BUCKET = "vendor-files";

/**
 * Streams a private vendor-files object to the caller.
 *
 * The path segment is an HMAC token minted by getVendorFileStreamUrl /
 * getQuoteFileStreamUrl after authorization. We re-sign the storage URL
 * server-side, fetch with the caller's Range header forwarded, and pipe
 * the response back. This gives the browser <video> tag a same-origin
 * URL with proper Range support, which avoids signed-URL quirks across
 * networks and is essential for inline mp4 playback / seeking.
 */
export const Route = createFileRoute("/api/files/stream/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = (params as { _splat?: string })._splat ?? "";
        const verified = verifyFileStreamToken(token);
        if (!verified) {
          return new Response("Invalid or expired link", { status: 401 });
        }

        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(verified.filePath, 60);
        if (signErr || !signed?.signedUrl) {
          return new Response("File not found", { status: 404 });
        }

        const forwardHeaders: Record<string, string> = {};
        const range = request.headers.get("range");
        if (range) forwardHeaders["range"] = range;
        const ifRange = request.headers.get("if-range");
        if (ifRange) forwardHeaders["if-range"] = ifRange;

        const upstream = await fetch(signed.signedUrl, { headers: forwardHeaders });

        if (upstream.status === 400 || upstream.status === 404) {
          return new Response("File not found", { status: 404 });
        }

        // Pass through body + relevant headers.
        const headers = new Headers();
        const passthrough = [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "etag",
          "last-modified",
          "cache-control",
        ];
        for (const name of passthrough) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
        if (!headers.has("cache-control")) headers.set("cache-control", "private, max-age=60");

        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        });
      },
    },
  },
});
