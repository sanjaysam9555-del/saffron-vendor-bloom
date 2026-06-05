import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signFileStreamToken } from "@/server/file-stream-token.server";

const BUCKET = "vendor-files";

async function authorizeVendorFiles(userId: string, filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) return;
  const { data: rows, error: attErr } = await supabaseAdmin
    .from("vendor_attachments")
    .select("vendor_id, file_path")
    .in("file_path", filePaths);
  if (attErr) throw new Error(attErr.message);
  if (!rows || rows.length === 0) throw new Error("File not found");

  const foundPaths = new Set(rows.map((r) => r.file_path));
  for (const p of filePaths) {
    if (!foundPaths.has(p)) throw new Error("File not found");
  }

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isStaff = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "employee",
  );

  if (isStaff) return;

  const vendorIds = Array.from(new Set(rows.map((r) => r.vendor_id)));
  for (const vendorId of vendorIds) {
    const { data: allowed, error: aErr } = await supabaseAdmin.rpc(
      "client_can_view_vendor",
      { _user_id: userId, _vendor_id: vendorId },
    );
    if (aErr) throw new Error(aErr.message);
    if (!allowed) throw new Error("Forbidden");
  }
}

async function authorizeVendorFile(userId: string, filePath: string): Promise<void> {
  await authorizeVendorFiles(userId, [filePath]);
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
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 300);
    if (!signed?.signedUrl) throw new Error(error?.message ?? "File missing from storage");
    return { url: signed.signedUrl };
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
    const token = signFileStreamToken(data.file_path);
    return { url: `/api/files/stream/${token}` };
  });

/**
 * Returns a short-lived signed URL with on-the-fly image resize transform.
 * Used to render small grid thumbnails without downloading the full original.
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

    const { data: plain } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 3600);
    if (!plain?.signedUrl) throw new Error(error?.message ?? "File missing from storage");
    return { url: plain.signedUrl };
  });

/**
 * Bulk variant: sign every thumbnail in one round-trip. Used by the
 * attachment grid so opening a vendor with N images costs one request
 * instead of N.
 */
export const getVendorFileThumbnailUrlsBulk = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        file_paths: z.array(z.string().min(1)).min(1).max(200),
        width: z.number().int().min(16).max(2000).default(400),
        height: z.number().int().min(16).max(2000).default(400),
        quality: z.number().int().min(20).max(100).default(70),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await authorizeVendorFiles(context.userId, data.file_paths);

    const out: Record<string, string> = {};
    await Promise.all(
      data.file_paths.map(async (path) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600, {
            transform: {
              width: data.width,
              height: data.height,
              resize: "cover",
              quality: data.quality,
            },
          });
        if (signed?.signedUrl) {
          out[path] = signed.signedUrl;
          return;
        }
        const { data: plain } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (plain?.signedUrl) out[path] = plain.signedUrl;
      }),
    );

    return { urls: out };
  });
