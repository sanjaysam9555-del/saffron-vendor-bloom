import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeInstagramHandle } from "@/lib/instagram";
import { scrapeInstagramProfile } from "@/server/instagram-preview.server";

/**
 * Scrape + upsert an Instagram preview row for a vendor.
 * Safe to call from server functions / public routes — never throws.
 * Returns true if a preview row was written.
 */
export async function triggerInstagramPreview(
  vendorId: string,
  rawHandle: string | null | undefined,
): Promise<boolean> {
  try {
    const handle = normalizeInstagramHandle(rawHandle);
    if (!handle) return false;

    // Skip if a successful preview already exists for this vendor.
    const { data: existing } = await supabaseAdmin
      .from("vendor_instagram_previews" as never)
      .select("status")
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (existing && (existing as { status?: string }).status === "ok") return false;

    const rawScrape = await scrapeInstagramProfile(handle);
    const { persistInstagramAssets } = await import("@/server/instagram-image-cache.server");
    const scrape = await persistInstagramAssets(vendorId, rawScrape);
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
      last_error: scrape.status === "ok" ? null : scrape.status === "error" ? scrape.error : null,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabaseAdmin
      .from("vendor_instagram_previews" as never) as unknown as {
        upsert: (r: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
      })
      .upsert(row, { onConflict: "vendor_id" });
    if (error) {
      console.error("[trigger-instagram-preview] upsert failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      "[trigger-instagram-preview] failed",
      e instanceof Error ? e.message.slice(0, 300) : e,
    );
    return false;
  }
}
