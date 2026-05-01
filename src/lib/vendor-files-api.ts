import { supabase } from "@/integrations/supabase/client";

export interface VendorAttachment {
  id: string;
  vendor_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const BUCKET = "vendor-files";

export async function listVendorAttachments(vendorId: string): Promise<VendorAttachment[]> {
  const { data, error } = await supabase
    .from("vendor_attachments")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VendorAttachment[];
}

export async function uploadVendorAttachment(vendorId: string, file: File): Promise<VendorAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${vendorId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("vendor_attachments")
    .insert({
      vendor_id: vendorId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) {
    // best-effort cleanup
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as VendorAttachment;
}

export async function deleteVendorAttachment(att: VendorAttachment): Promise<void> {
  await supabase.storage.from(BUCKET).remove([att.file_path]);
  const { error } = await supabase.from("vendor_attachments").delete().eq("id", att.id);
  if (error) throw error;
}

import { getVendorFileSignedUrl } from "@/server/vendor-files.functions";

export async function getAttachmentUrl(filePath: string): Promise<string> {
  const { url } = await getVendorFileSignedUrl({ data: { file_path: filePath } });
  return url;
}

export const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
