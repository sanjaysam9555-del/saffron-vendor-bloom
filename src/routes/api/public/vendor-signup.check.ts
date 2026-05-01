import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import {
  fieldHasDuplicate,
  duplicateMessageFor,
  type DuplicateField,
} from "@/server/duplicate-detection.server";

const ALLOWED: DuplicateField[] = [
  "vendor_name",
  "contact_number",
  "email",
  "instagram_handle",
  "website",
];

const checkHits = new Map<string, number[]>();
const CHECK_LIMIT = 60;
const CHECK_WINDOW_MS = 60 * 1000;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (checkHits.get(ip) ?? []).filter((t) => now - t < CHECK_WINDOW_MS);
  if (arr.length >= CHECK_LIMIT) {
    checkHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  checkHits.set(ip, arr);
  return true;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/vendor-signup/check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let ip = "unknown";
        try { ip = getRequestIP({ xForwardedFor: true }) ?? "unknown"; } catch { /* noop */ }

        if (!rateLimit(ip)) {
          return jsonResponse({ exists: false, rateLimited: true }, 429);
        }

        const url = new URL(request.url);
        const field = url.searchParams.get("field") as DuplicateField | null;
        const value = url.searchParams.get("value") ?? "";
        if (!field || !ALLOWED.includes(field)) {
          return jsonResponse({ exists: false, error: "invalid_field" }, 400);
        }
        if (!value.trim()) {
          return jsonResponse({ exists: false }, 200);
        }
        if (value.length > 300) {
          return jsonResponse({ exists: false, error: "value_too_long" }, 400);
        }

        try {
          const exists = await fieldHasDuplicate(field, value);
          return jsonResponse({
            exists,
            field,
            message: exists ? duplicateMessageFor(field) : null,
          });
        } catch (err) {
          console.error("Duplicate check failed:", err);
          return jsonResponse({ exists: false, error: "check_failed" }, 500);
        }
      },
    },
  },
});
