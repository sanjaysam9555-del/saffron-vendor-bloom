/**
 * Server-only helpers for the Instagram preview server functions.
 *
 * These used to live next to the `createServerFn` declarations, but the
 * server-fn split transform drops sibling runtime declarations from the
 * generated handler module, which made the handlers fail at runtime.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scrapeInstagramProfile } from "@/server/instagram-preview.server";
import { persistInstagramAssets } from "@/server/instagram-image-cache.server";
import type {
  VendorInstagramPreview,
  InstagramBackfillJob,
  InstagramBackfillJobRow,
} from "@/lib/instagram-preview-types";

export const STALE_DAYS = 3;
export const BATCH_SIZE = 3;

/** True if any of `urls` still references an Instagram CDN host (signed + expiring). */
export function hasEphemeralCdnUrl(urls: Array<string | null | undefined>): boolean {
  return urls.some((u) => !!u && /(cdninstagram\.com|fbcdn\.net)/i.test(u));
}

export async function requireUser(): Promise<{ userId: string; isStaff: boolean }> {
  const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) {
    console.error("[instagram-preview] requireUser: missing authorization header");
    throw new Error("You're not signed in.");
  }
  let userId: string | undefined;
  // Prefer getClaims (cheap, signature-verified). Fall back to getUser if
  // claim verification rejects the token (e.g. JWKS rotation, clock skew).
  const claimsRes = await supabaseAdmin.auth.getClaims(token);
  userId = claimsRes.data?.claims?.sub;
  if (!userId) {
    const userRes = await supabaseAdmin.auth.getUser(token);
    userId = userRes.data?.user?.id;
    if (!userId) {
      console.error("[instagram-preview] requireUser: token rejected", {
        claimsErr: claimsRes.error?.message,
        userErr: userRes.error?.message,
      });
      throw new Error("Your session expired.");
    }
  }
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "employee"]);
  return { userId, isStaff: !!roles && roles.length > 0 };
}

type UpsertShim = {
  upsert: (r: unknown, opts: { onConflict: string }) => {
    select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
  };
};

export async function upsertPreview(
  vendorId: string,
  scrape: Awaited<ReturnType<typeof scrapeInstagramProfile>>,
): Promise<VendorInstagramPreview | null> {
  const { data: existing } = await supabaseAdmin
    .from("vendor_instagram_previews" as never)
    .select("*")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  const existingRow = existing as unknown as VendorInstagramPreview | null;
  if (scrape.status === "error" && existingRow?.status === "ok") {
    return existingRow;
  }

  // For successful scrapes, mirror avatar + thumbnails into our cache bucket
  // so the URLs we store never expire. Failures fall back to the original
  // CDN URL inside the helper.
  const persisted = await persistInstagramAssets(vendorId, scrape);

  const row = {
    vendor_id: vendorId,
    handle: persisted.handle,
    profile_url:
      persisted.status === "error" && !persisted.profile_url ? null : persisted.profile_url,
    avatar_url: persisted.status === "ok" ? persisted.avatar_url : null,
    display_name: persisted.status === "ok" ? persisted.display_name : null,
    bio: persisted.status === "ok" ? persisted.bio : null,
    followers_text: persisted.status === "ok" ? persisted.followers_text : null,
    post_thumbnails: persisted.status === "ok" ? persisted.post_thumbnails : null,
    status: scrape.status,
    last_error: scrape.status === "ok" ? null : scrape.error ?? null,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await (supabaseAdmin
    .from("vendor_instagram_previews" as never) as unknown as UpsertShim)
    .upsert(row, { onConflict: "vendor_id" })
    .select()
    .single();
  if (error) {
    console.error("[instagram-preview] upsert failed", error.message);
    return null;
  }
  return data as unknown as VendorInstagramPreview;
}

export async function mirrorExistingPreviewAssets(
  vendorId: string,
  row: VendorInstagramPreview,
): Promise<VendorInstagramPreview | null> {
  if (row.status !== "ok") return row;
  const mirrored = await persistInstagramAssets(vendorId, {
    status: "ok",
    handle: row.handle ?? "",
    profile_url: row.profile_url ?? (row.handle ? `https://www.instagram.com/${row.handle}/` : ""),
    avatar_url: row.avatar_url,
    display_name: row.display_name,
    bio: row.bio,
    followers_text: row.followers_text,
    post_thumbnails: row.post_thumbnails ?? [],
  });

  if (mirrored.status !== "ok") return row;

  const next = {
    ...row,
    handle: mirrored.handle || row.handle,
    profile_url: mirrored.profile_url || row.profile_url,
    avatar_url: mirrored.avatar_url,
    post_thumbnails: mirrored.post_thumbnails,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await (supabaseAdmin
    .from("vendor_instagram_previews" as never) as unknown as UpsertShim)
    .upsert(next, { onConflict: "vendor_id" })
    .select()
    .single();
  if (error) {
    console.error("[instagram-preview] mirror upsert failed", error.message);
    return row;
  }
  return data as unknown as VendorInstagramPreview;
}

export function toPublicJob(row: InstagramBackfillJobRow): InstagramBackfillJob {
  return {
    id: row.id,
    status: (row.status as InstagramBackfillJob["status"]) ?? "running",
    total: row.total,
    processed: row.processed,
    ok: row.ok,
    errors: row.errors,
    pending_count: row.pending_vendor_ids?.length ?? 0,
    last_error: row.last_error,
    started_at: row.started_at,
    updated_at: row.updated_at,
  };
}
