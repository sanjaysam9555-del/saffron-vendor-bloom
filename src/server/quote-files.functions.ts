import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "vendor-files";

/**
 * Returns a short-lived signed URL for a quote file.
 * Authorization:
 *   - Staff (admin/employee): always allowed
 *   - Clients: allowed only if the quote belongs to a project they are part of
 */
export const getQuoteFileSignedUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const userId = context.userId;

    const { data: file, error: fErr } = await supabaseAdmin
      .from("project_vendor_quote_files")
      .select("id, quote_id, project_vendor_quotes!inner(project_id)")
      .eq("file_path", data.file_path)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!file) throw new Error("File not found");

    const projectId = (file as any).project_vendor_quotes?.project_id as string | undefined;
    if (!projectId) throw new Error("File not found");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "employee");

    if (!isStaff) {
      const { data: allowed, error: aErr } = await supabaseAdmin.rpc("has_project_access", {
        _user_id: userId,
        _project_id: projectId,
      });
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
