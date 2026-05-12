import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";
import { scrapeInstagramProfile } from "./instagram-preview.server";

export interface VendorInstagramPreview {
  vendor_id: string;
  handle: string | null;
  avatar_url: string | null;
  display_name: string | null;
  bio: string | null;
  followers_text: string | null;
  post_thumbnails: string[] | null;
  profile_url: string | null;
  status: "ok" | "not_found" | "error";
  last_error: string | null;
  fetched_at: string;
  updated_at: string;
}

const STALE_DAYS = 30;

async function requireUser(): Promise<{ userId: string; isStaff: boolean }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new Error("You're not signed in.");
  const { data, error } = await supabaseAdmin.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) throw new Error("Your session expired.");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  return { userId, isStaff: !!roles && roles.length > 0 };
}

async function upsertPreview(
  vendorId: string,
  scrape: Awaited<ReturnType<typeof scrapeInstagramProfile>>,
): Promise<VendorInstagramPreview | null> {
  const row = {
    vendor_id: vendorId,
    handle: scrape.handle,
    profile_url: scrape.status === "error" && !scrape.profile_url ? null : scrape.profile_url,
    avatar_url: scrape.status === "ok" ? scrape.avatar_url : null,
    display_name: scrape.status === "ok" ? scrape.display_name : null,
    bio: scrape.status === "ok" ? scrape.bio : null,
    followers_text: scrape.status === "ok" ? scrape.followers_text : null,
    post_thumbnails: scrape.status === "ok" ? scrape.post_thumbnails : null,
    status: scrape.status,
    last_error: scrape.status === "ok" ? null : scrape.error ?? null,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("vendor_instagram_previews" as never)
    .upsert(row, { onConflict: "vendor_id" })
    .select()
    .single();
  if (error) {
    console.error("[instagram-preview] upsert failed", error.message);
    return null;
  }
  return data as unknown as VendorInstagramPreview;
}

export const getVendorInstagramPreviewsBulk = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ vendorIds: z.array(z.string().uuid()).min(0).max(500) }).parse(d),
  )
  .handler(async ({ data }): Promise<VendorInstagramPreview[]> => {
    await requireUser();
    if (data.vendorIds.length === 0) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("vendor_instagram_previews" as never)
      .select("*")
      .in("vendor_id", data.vendorIds);
    if (error) {
      console.error("[instagram-preview] bulk read failed", error.message);
      return [];
    }
    return (rows ?? []) as unknown as VendorInstagramPreview[];
  });

export const refreshVendorInstagramPreview = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ vendorId: z.string().uuid(), handle: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<VendorInstagramPreview | null> => {
    const { isStaff } = await requireUser();
    if (!isStaff) throw new Error("Forbidden: staff only");
    const scrape = await scrapeInstagramProfile(data.handle);
    return upsertPreview(data.vendorId, scrape);
  });

export const ensureVendorInstagramPreview = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ vendorId: z.string().uuid(), handle: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<VendorInstagramPreview | null> => {
    const { isStaff } = await requireUser();
    // Only staff can trigger fresh scrapes; clients only read cache.
    const { data: existing } = await supabaseAdmin
      .from("vendor_instagram_previews" as never)
      .select("*")
      .eq("vendor_id", data.vendorId)
      .maybeSingle();
    const row = existing as unknown as VendorInstagramPreview | null;
    const ageMs = row ? Date.now() - new Date(row.fetched_at).getTime() : Infinity;
    const stale = ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;
    const failed = row?.status === "error";
    if (row && !stale && !failed) return row;
    if (!isStaff) return row;
    const scrape = await scrapeInstagramProfile(data.handle);
    return upsertPreview(data.vendorId, scrape);
  });
