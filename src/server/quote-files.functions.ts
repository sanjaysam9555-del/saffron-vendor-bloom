import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachAuthToken } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signFileStreamToken } from "./file-stream-token.server";

const BUCKET = "vendor-files";

async function authorizeQuoteFile(userId: string, filePath: string): Promise<void> {
  const { data: file, error: fErr } = await supabaseAdmin
    .from("project_vendor_quote_files")
    .select("id, quote_id, project_vendor_quotes!inner(project_id)")
    .eq("file_path", filePath)
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
}

async function ensureStorageObjectExists(filePath: string): Promise<string> {
  const { data: signed } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 300);
  if (!signed?.signedUrl) throw new Error("File missing from storage");
  try {
    const probe = await fetch(signed.signedUrl, { method: "HEAD" });
    if (probe.status === 400 || probe.status === 404) {
      throw new Error("File missing from storage");
    }
  } catch (e) {
    if (e instanceof Error && e.message === "File missing from storage") throw e;
  }
  return signed.signedUrl;
}

export const getQuoteFileSignedUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await authorizeQuoteFile(context.userId, data.file_path);
    const url = await ensureStorageObjectExists(data.file_path);
    return { url };
  });

export const getQuoteFileStreamUrl = createServerFn({ method: "POST" })
  .middleware([attachAuthToken, requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await authorizeQuoteFile(context.userId, data.file_path);
    await ensureStorageObjectExists(data.file_path);
    const token = signFileStreamToken(data.file_path);
    return { url: `/api/files/stream/${token}` };
  });
