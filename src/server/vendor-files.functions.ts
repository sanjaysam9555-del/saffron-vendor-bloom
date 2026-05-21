import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signFileStreamToken } from "./file-stream-token.server";

const BUCKET = "vendor-files";

async function authorizeVendorFile(userId: string, filePath: string): Promise<void> {
  const { data: att, error: attErr } = await supabaseAdmin
    .from("vendor_attachments")
    .select("vendor_id")
    .eq("file_path", filePath)
    .maybeSingle();
  if (attErr) throw new Error(attErr.message);
  if (!att) throw new Error("File not found");

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isStaff = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "employee",
  );

  if (!isStaff) {
    const { data: allowed, error: aErr } = await supabaseAdmin.rpc(
      "client_can_view_vendor",
      { _user_id: userId, _vendor_id: att.vendor_id },
    );
    if (aErr) throw new Error(aErr.message);
    if (!allowed) throw new Error("Forbidden");
  }
}

/**
 * Returns a short-lived signed URL for a vendor-files object.
 * Used for documents/images (PDFs, jpg, etc.) where direct storage URL works fine.
 */
export const getVendorFileSignedUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await authorizeVendorFile(context.userId, data.file_path);

    // Verify the storage object actually exists before handing out a URL,
    // so missing files surface a clear error instead of broken playback.
    const { data: head } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 300);
    if (!head?.signedUrl) {
      throw new Error("File missing from storage");
    }

    // Probe with HEAD so stale DB rows whose blobs were removed report as missing.
    try {
      const probe = await fetch(head.signedUrl, { method: "HEAD" });
      if (probe.status === 400 || probe.status === 404) {
        throw new Error("File missing from storage");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "File missing from storage") throw e;
      // Network probe failed — fall through and let the client try the URL.
    }

    return { url: head.signedUrl };
  });

/**
 * Returns a same-origin streaming URL for a vendor-files object.
 * Use this for videos: the browser <video> element gets a same-origin URL
 * with full Range support, avoiding signed-URL quirks across networks.
 */
export const getVendorFileStreamUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await authorizeVendorFile(context.userId, data.file_path);

    // Verify object exists before issuing a stream token.
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 60);
    if (!signed?.signedUrl) throw new Error("File missing from storage");
    try {
      const probe = await fetch(signed.signedUrl, { method: "HEAD" });
      if (probe.status === 400 || probe.status === 404) {
        throw new Error("File missing from storage");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "File missing from storage") throw e;
    }

    const token = signFileStreamToken(data.file_path);
    return { url: `/api/files/stream/${token}` };
  });

/**
 * Returns a short-lived signed URL with on-the-fly image resize transform.
 * Used to render small grid thumbnails without downloading the full original.
 * Falls back to a plain signed URL if the transform pipeline rejects the file.
 */
export const getVendorFileThumbnailUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        file_path: z.string().min(1),
        width: z.number().int().min(16).max(2000).default(400),
        height: z.number().int().min(16).max(2000).default(400),
        quality: z.number().int().min(20).max(100).default(70),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await authorizeVendorFile(context.userId, data.file_path);

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 3600, {
        transform: {
          width: data.width,
          height: data.height,
          resize: "cover",
          quality: data.quality,
        },
      });

    if (signed?.signedUrl) return { url: signed.signedUrl };

    // Fall back to a plain signed URL (e.g. for non-image content types).
    const { data: plain } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 3600);
    if (!plain?.signedUrl) throw new Error(error?.message ?? "File missing from storage");
    return { url: plain.signedUrl };
  });

