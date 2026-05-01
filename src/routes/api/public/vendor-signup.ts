import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestIP } from "@tanstack/react-start/server";
import {
  findDuplicateVendor,
} from "@/server/duplicate-detection.server";

const BUCKET = "vendor-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 60 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "jpg", "jpeg", "png", "webp",
]);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const payloadSchema = z.object({
  vendor_name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().min(1).max(200),
  contact_number: z.string().trim().min(6).max(40),
  email: z.string().trim().max(200).email().nullable().optional().or(z.literal("")),
  instagram_handle: z.string().trim().min(1).max(100),
  website: z.string().trim().max(300).nullable().optional(),
  google_rating: z.number().min(0).max(5).nullable().optional(),
  price_text: z.string().trim().max(300).nullable().optional(),
  commission_model: z.string().trim().max(200).nullable().optional(),
  portfolio_link: z.string().trim().max(500).nullable().optional(),
  remarks: z.string().trim().max(2000).nullable().optional(),
  number_of_rooms: z.number().int().min(0).max(10000).nullable().optional(),
  distance_from_delhi: z.string().trim().max(100).nullable().optional(),
  hotel_category: z.string().trim().max(100).nullable().optional(),
  quote_breakdown: z.string().trim().max(2000).nullable().optional(),
  team_size: z.string().trim().max(200).nullable().optional(),
  deliverables: z.string().trim().max(500).nullable().optional(),
  honeypot: z.string().max(0).optional(), // must be empty
});

// In-memory rate limiter (per worker instance — best effort)
const submitHits = new Map<string, number[]>();
const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_MS = 60 * 60 * 1000;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (submitHits.get(ip) ?? []).filter((t) => now - t < SUBMIT_WINDOW_MS);
  if (arr.length >= SUBMIT_LIMIT) {
    submitHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  submitHits.set(ip, arr);
  return true;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function getExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/vendor-signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let ip = "unknown";
        try { ip = getRequestIP({ xForwardedFor: true }) ?? "unknown"; } catch { /* noop */ }

        if (!rateLimit(ip)) {
          return jsonResponse(
            { ok: false, error: "rate_limited", message: "Too many submissions. Please try again later." },
            429,
          );
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return jsonResponse({ ok: false, error: "invalid_form", message: "Invalid form data" }, 400);
        }

        const rawPayload = formData.get("payload");
        if (typeof rawPayload !== "string") {
          return jsonResponse({ ok: false, error: "missing_payload", message: "Missing payload" }, 400);
        }

        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(JSON.parse(rawPayload));
        } catch (err) {
          const msg = err instanceof z.ZodError
            ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : "Invalid payload";
          return jsonResponse({ ok: false, error: "validation", message: msg }, 400);
        }

        // Honeypot
        if (parsed.honeypot && parsed.honeypot.length > 0) {
          return jsonResponse({ ok: true }, 200); // pretend success for bots
        }

        // Duplicate check
        const dup = await findDuplicateVendor({
          vendor_name: parsed.vendor_name,
          contact_number: parsed.contact_number,
          email: parsed.email || null,
          instagram_handle: parsed.instagram_handle,
          website: parsed.website || null,
        });
        if (dup) {
          return jsonResponse(
            { ok: false, error: "duplicate", field: dup.field, message: dup.message },
            409,
          );
        }

        // Validate files
        const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
        if (files.length > MAX_FILES) {
          return jsonResponse({ ok: false, error: "too_many_files", message: `Maximum ${MAX_FILES} files allowed.` }, 400);
        }
        let totalSize = 0;
        for (const f of files) {
          if (f.size > MAX_FILE_SIZE) {
            return jsonResponse({ ok: false, error: "file_too_large", message: `"${f.name}" exceeds 20 MB.` }, 400);
          }
          const ext = getExt(f.name);
          if (!ALLOWED_EXT.has(ext)) {
            return jsonResponse({ ok: false, error: "unsupported_type", message: `"${f.name}" has an unsupported file type.` }, 400);
          }
          if (f.type && !ALLOWED_MIME.has(f.type)) {
            return jsonResponse({ ok: false, error: "unsupported_type", message: `"${f.name}" has an unsupported file type.` }, 400);
          }
          totalSize += f.size;
        }
        if (totalSize > MAX_TOTAL_SIZE) {
          return jsonResponse({ ok: false, error: "total_too_large", message: "Total upload size exceeds 60 MB." }, 400);
        }

        // Insert vendor
        const insertRow = {
          vendor_name: parsed.vendor_name,
          category: parsed.category,
          subcategory: parsed.subcategory || null,
          location: parsed.location,
          contact_number: parsed.contact_number,
          email: parsed.email || null,
          instagram_handle: parsed.instagram_handle.replace(/^@+/, ""),
          website: parsed.website || null,
          google_rating: parsed.google_rating ?? null,
          price_text: parsed.price_text || null,
          commission_model: parsed.commission_model || null,
          portfolio_link: parsed.portfolio_link || null,
          remarks: parsed.remarks || null,
          number_of_rooms: parsed.number_of_rooms ?? null,
          distance_from_delhi: parsed.distance_from_delhi || null,
          hotel_category: parsed.hotel_category || null,
          quote_breakdown: parsed.quote_breakdown || null,
          team_size: parsed.team_size || null,
          deliverables: parsed.deliverables || null,
          source: "Vendor Signup Form",
          submitted_via_form: true,
        };

        const { data: vendor, error: insertErr } = await supabaseAdmin
          .from("vendors")
          .insert(insertRow)
          .select("id")
          .single();
        if (insertErr || !vendor) {
          console.error("Vendor signup insert failed:", insertErr);
          return jsonResponse({ ok: false, error: "insert_failed", message: "Could not save your details. Please try again." }, 500);
        }

        // Upload files
        const uploaded: string[] = [];
        try {
          for (const file of files) {
            const path = `submissions/${vendor.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
            const buf = await file.arrayBuffer();
            const { error: upErr } = await supabaseAdmin.storage
              .from(BUCKET)
              .upload(path, buf, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });
            if (upErr) throw new Error(upErr.message);
            uploaded.push(path);

            const { error: attErr } = await supabaseAdmin
              .from("vendor_attachments")
              .insert({
                vendor_id: vendor.id,
                file_path: path,
                file_name: file.name,
                mime_type: file.type || null,
                size_bytes: file.size,
              });
            if (attErr) throw new Error(attErr.message);
          }
        } catch (err) {
          console.error("Vendor signup file upload failed, rolling back:", err);
          // Best-effort cleanup
          try {
            if (uploaded.length > 0) {
              await supabaseAdmin.storage.from(BUCKET).remove(uploaded);
            }
          } catch { /* ignore */ }
          try { await supabaseAdmin.from("vendor_attachments").delete().eq("vendor_id", vendor.id); } catch { /* ignore */ }
          try { await supabaseAdmin.from("vendors").delete().eq("id", vendor.id); } catch { /* ignore */ }
          return jsonResponse({ ok: false, error: "upload_failed", message: "Could not upload your documents. Please try again." }, 500);
        }

        return jsonResponse({ ok: true }, 200);
      },
    },
  },
});
