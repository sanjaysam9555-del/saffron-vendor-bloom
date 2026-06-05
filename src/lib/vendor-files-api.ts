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

const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const COMPRESS_MAX_DIMENSION = 2000;
const COMPRESS_QUALITY = 0.82;
const COMPRESS_SKIP_BELOW_BYTES = 400 * 1024;

async function compressImageIfNeeded(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  const type = (file.type || "").toLowerCase();
  if (!COMPRESSIBLE_IMAGE_TYPES.has(type)) return file;
  if (file.size <= COMPRESS_SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const maxSide = Math.max(width, height);
    const scale = maxSide > COMPRESS_MAX_DIMENSION ? COMPRESS_MAX_DIMENSION / maxSide : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", COMPRESS_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function uploadVendorAttachment(vendorId: string, file: File): Promise<VendorAttachment> {
  const originalName = file.name;
  const uploadFile = await compressImageIfNeeded(file);
  const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${vendorId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, uploadFile, {
    contentType: uploadFile.type || undefined,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("vendor_attachments")
    .insert({
      vendor_id: vendorId,
      file_path: path,
      file_name: originalName,
      mime_type: uploadFile.type || null,
      size_bytes: uploadFile.size,
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

import {
  getVendorFileSignedUrl,
  getVendorFileStreamUrl,
  getVendorFileThumbnailUrl,
  getVendorFileThumbnailUrlsBulk,
} from "@/lib/vendor-files.functions";

export async function getAttachmentUrl(filePath: string): Promise<string> {
  const { url } = await getVendorFileSignedUrl({ data: { file_path: filePath } });
  return url;
}

export async function getAttachmentStreamUrl(filePath: string): Promise<string> {
  const { url } = await getVendorFileStreamUrl({ data: { file_path: filePath } });
  return url;
}

export async function getAttachmentThumbnailUrl(
  filePath: string,
  opts: { width?: number; height?: number; quality?: number } = {},
): Promise<string> {
  const { url } = await getVendorFileThumbnailUrl({
    data: {
      file_path: filePath,
      width: opts.width ?? 400,
      height: opts.height ?? 400,
      quality: opts.quality ?? 70,
    },
  });
  return url;
}

export async function getAttachmentThumbnailUrlsBulk(
  filePaths: string[],
  opts: { width?: number; height?: number; quality?: number } = {},
): Promise<Record<string, string>> {
  if (filePaths.length === 0) return {};
  const { urls } = await getVendorFileThumbnailUrlsBulk({
    data: {
      file_paths: filePaths,
      width: opts.width ?? 400,
      height: opts.height ?? 400,
      quality: opts.quality ?? 70,
    },
  });
  return urls;
}

export const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.m4v";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (documents & images)
export const MAX_VIDEO_FILE_SIZE = 200 * 1024 * 1024; // 200 MB (videos)

const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|mkv|avi)$/i;

export function isVideoFile(file: { name: string; type?: string }): boolean {
  if (file.type && file.type.toLowerCase().startsWith("video/")) return true;
  return VIDEO_EXT_RE.test(file.name);
}

export function maxFileSizeFor(file: { name: string; type?: string }): number {
  return isVideoFile(file) ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
