import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "vendor-files";

/**
 * Returns a short-lived signed URL for a vendor-files object.
 * Authorization:
 *   - Staff (admin/employee): always allowed
 *   - Clients: allowed only if the file's vendor is assigned to one of their projects
 */
export const getVendorFileSignedUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const userId = context.userId;

    // Look up the attachment to find the vendor it belongs to
    const { data: att, error: attErr } = await supabaseAdmin
      .from("vendor_attachments")
      .select("vendor_id")
      .eq("file_path", data.file_path)
      .maybeSingle();
    if (attErr) throw new Error(attErr.message);
    if (!att) throw new Error("File not found");

    // Check authorization
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isStaff = (roles ?? []).some(
      (r) => r.role === "admin" || r.role === "employee",
    );

    if (!isStaff) {
      // Client: must have project access to a project that includes this vendor
      const { data: allowed, error: aErr } = await supabaseAdmin.rpc(
        "client_can_view_vendor",
        { _user_id: userId, _vendor_id: att.vendor_id },
      );
      if (aErr) throw new Error(aErr.message);
      if (!allowed) throw new Error("Forbidden");
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 300);
    if (sErr || !signed?.signedUrl) {
      throw new Error(sErr?.message ?? "Failed to sign URL");
    }
    return { url: signed.signedUrl };
  });
