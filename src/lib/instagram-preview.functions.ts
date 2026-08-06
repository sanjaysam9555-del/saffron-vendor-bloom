import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";
import { scrapeInstagramProfile } from "@/server/instagram-preview.server";
import {
  STALE_DAYS,
  BATCH_SIZE,
  hasEphemeralCdnUrl,
  requireUser,
  upsertPreview,
  mirrorExistingPreviewAssets,
  toPublicJob,
} from "@/server/instagram-preview-helpers.server";
import type {
  VendorInstagramPreview,
  InstagramBackfillJob,
  InstagramBackfillJobRow as JobRow,
} from "@/lib/instagram-preview-types";

export type { VendorInstagramPreview, InstagramBackfillJob };

export const getVendorInstagramPreviewsBulk = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ vendorIds: z.array(z.string().uuid()).min(0).max(500) }).parse(d),
  )
  .handler(async ({ data }): Promise<VendorInstagramPreview[]> => {
    const { userId, isStaff } = await requireUser();
    if (data.vendorIds.length === 0) return [];

    let allowedIds = data.vendorIds;
    if (!isStaff) {
      // Clients may only see Instagram previews for vendors attached to
      // projects they're assigned to. Filter the requested IDs accordingly.
      const { data: projectLinks, error: pcErr } = await supabaseAdmin
        .from("project_clients")
        .select("project_id")
        .eq("user_id", userId);
      if (pcErr) console.error("[instagram-preview] project_clients read failed", pcErr.message);
      const projectIds = (projectLinks ?? []).map((r) => r.project_id as string);
      if (projectIds.length === 0) {
        console.warn("[instagram-preview] client has no project links", { userId });
        return [];
      }
      const { data: pv, error: pvErr } = await supabaseAdmin
        .from("project_vendors")
        .select("vendor_id")
        .in("project_id", projectIds)
        .in("vendor_id", data.vendorIds);
      if (pvErr) console.error("[instagram-preview] project_vendors read failed", pvErr.message);
      const allowed = new Set((pv ?? []).map((r) => r.vendor_id as string));
      allowedIds = data.vendorIds.filter((id) => allowed.has(id));
      if (allowedIds.length === 0) {
        console.warn("[instagram-preview] no allowed vendor ids", {
          userId,
          requested: data.vendorIds.length,
          projectIds: projectIds.length,
        });
        return [];
      }
    }

    // Chunk the .in() query — a single .in() with hundreds of UUIDs builds a
    // URL that exceeds the Worker fetch URL limit and throws "fetch failed".
    const CHUNK = 100;
    const allRows: unknown[] = [];
    for (let i = 0; i < allowedIds.length; i += CHUNK) {
      const slice = allowedIds.slice(i, i + CHUNK);
      const { data: rows, error } = await supabaseAdmin
        .from("vendor_instagram_previews" as never)
        .select("*")
        .in("vendor_id", slice);
      if (error) {
        console.error("[instagram-preview] bulk read failed", error.message);
        return [];
      }
      if (rows) allRows.push(...(rows as unknown[]));
    }
    console.log("[instagram-preview] bulk ok", {
      userId,
      isStaff,
      requested: data.vendorIds.length,
      allowed: allowedIds.length,
      returned: allRows.length,
    });
    return allRows as unknown as VendorInstagramPreview[];
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
    z
      .object({
        vendorId: z.string().uuid(),
        handle: z.string().min(1),
        force: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<VendorInstagramPreview | null> => {
    const { isStaff } = await requireUser();
    // Scraping is staff-only. Clients read via the bulk endpoint; they
    // never trigger Apify.
    if (!isStaff) return null;

    const { data: existing } = await supabaseAdmin
      .from("vendor_instagram_previews" as never)
      .select("*")
      .eq("vendor_id", data.vendorId)
      .maybeSingle();
    const row = existing as unknown as VendorInstagramPreview | null;

    // If the stored row is OK, keep it — unless it still points at the
    // Instagram CDN (signed URLs that expire within hours) or the caller
    // explicitly forces a refresh. Migrating those rows over to our cache
    // bucket is what gets the blank thumbnails back.
    if (row && row.status === "ok") {
      const stillEphemeral = hasEphemeralCdnUrl([
        row.avatar_url,
        ...(row.post_thumbnails ?? []),
      ]);
      if (!data.force && !stillEphemeral) return row;
      if (!data.force && stillEphemeral) {
        // Existing previews should not spend a scraper run just to replace
        // expiring image URLs. First try to mirror the already-stored image
        // URLs into our cache bucket. If those signed CDN URLs have already
        // expired, mirroring returns the original row; in that case fall
        // through to a normal refresh so filtered cards do not stay blank.
        const mirrored = await mirrorExistingPreviewAssets(data.vendorId, row);
        if (
          mirrored &&
          !hasEphemeralCdnUrl([mirrored.avatar_url, ...(mirrored.post_thumbnails ?? [])])
        ) {
          return mirrored;
        }
      }
    } else if (row && !data.force) {
      // error / not_found rows: respect cooldown unless force-retry.
      return row;
    }

    const reason = !row
      ? "missing"
      : data.force
        ? "force-retry"
        : row.status === "ok"
          ? "ephemeral-urls"
          : "force-retry";
    console.info(
      `[instagram-preview] scraping vendor=${data.vendorId} handle=${data.handle} reason=${reason}`,
    );
    const scrape = await scrapeInstagramProfile(data.handle);
    return upsertPreview(data.vendorId, scrape);
  });

// ---------------------------------------------------------------------------
// Bulk backfill
// ---------------------------------------------------------------------------

export const startInstagramBackfill = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ mode: z.enum(["missing_or_stale", "missing_only", "all"]).default("missing_or_stale") }).parse(d),
  )
  .handler(async ({ data }): Promise<InstagramBackfillJob> => {
    const { userId, isStaff } = await requireUser();
    if (!isStaff) throw new Error("Forbidden: staff only");

    // 1. All vendors with a handle.
    const { data: vendors, error: vErr } = await supabaseAdmin
      .from("vendors")
      .select("id, instagram_handle")
      .not("instagram_handle", "is", null);
    if (vErr) throw new Error(vErr.message);

    const candidateIds = (vendors ?? [])
      .filter((v) => (v.instagram_handle ?? "").trim().length > 0)
      .map((v) => v.id as string);

    let pending: string[] = candidateIds;

    if (data.mode === "missing_or_stale") {
      const { data: previews } = await supabaseAdmin
        .from("vendor_instagram_previews" as never)
        .select("vendor_id, status, fetched_at")
        .in("vendor_id", candidateIds);
      const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
      const fresh = new Set<string>();
      ((previews ?? []) as unknown as Array<{ vendor_id: string; status: string; fetched_at: string }>)
        .forEach((p) => {
          const ageOk = new Date(p.fetched_at).getTime() >= cutoff;
          if (p.status === "ok" && ageOk) fresh.add(p.vendor_id);
        });
      pending = candidateIds.filter((id) => !fresh.has(id));
    } else if (data.mode === "missing_only") {
      // Bulk sync never touches a vendor that already has a preview row —
      // refreshing an existing one is a manual, per-card action only.
      const { data: previews } = await supabaseAdmin
        .from("vendor_instagram_previews" as never)
        .select("vendor_id")
        .in("vendor_id", candidateIds);
      const hasPreview = new Set(
        ((previews ?? []) as unknown as Array<{ vendor_id: string }>).map((p) => p.vendor_id),
      );
      pending = candidateIds.filter((id) => !hasPreview.has(id));
    }

    const { data: job, error: jErr } = await (supabaseAdmin
      .from("instagram_backfill_jobs" as never) as unknown as {
        insert: (r: unknown) => {
          select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      })
      .insert({
        started_by: userId,
        status: pending.length === 0 ? "done" : "running",
        total: pending.length,
        pending_vendor_ids: pending,
      })
      .select()
      .single();
    if (jErr) throw new Error(jErr.message);
    return toPublicJob(job as JobRow);
  });

export const processInstagramBackfillBatch = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<InstagramBackfillJob> => {
    const { isStaff } = await requireUser();
    if (!isStaff) throw new Error("Forbidden: staff only");

    const { data: jobRow, error } = await supabaseAdmin
      .from("instagram_backfill_jobs" as never)
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!jobRow) throw new Error("Backfill job not found");
    const job = jobRow as unknown as JobRow;

    if (job.status !== "running" || job.pending_vendor_ids.length === 0) {
      return toPublicJob(job);
    }

    const batch = job.pending_vendor_ids.slice(0, BATCH_SIZE);
    const remaining = job.pending_vendor_ids.slice(BATCH_SIZE);

    // Lookup handles for this batch.
    const { data: vendors } = await supabaseAdmin
      .from("vendors")
      .select("id, instagram_handle")
      .in("id", batch);
    const handleMap = new Map<string, string | null>();
    (vendors ?? []).forEach((v) => handleMap.set(v.id as string, (v.instagram_handle as string | null) ?? null));

    let okDelta = 0;
    let errDelta = 0;
    let lastError: string | null = job.last_error;

    for (const vendorId of batch) {
      const handle = handleMap.get(vendorId);
      if (!handle) {
        errDelta += 1;
        lastError = `No handle for vendor ${vendorId}`;
        continue;
      }
      try {
        const scrape = await scrapeInstagramProfile(handle);
        await upsertPreview(vendorId, scrape);
        if (scrape.status === "ok") okDelta += 1;
        else {
          errDelta += 1;
          lastError = scrape.status === "error" ? scrape.error : `not_found: ${handle}`;
        }
      } catch (e) {
        errDelta += 1;
        lastError = e instanceof Error ? e.message.slice(0, 300) : "Unknown error";
      }
    }

    const newProcessed = job.processed + batch.length;
    const newOk = job.ok + okDelta;
    const newErrors = job.errors + errDelta;
    const newStatus = remaining.length === 0 ? "done" : "running";

    const { data: updated, error: uErr } = await (supabaseAdmin
      .from("instagram_backfill_jobs" as never) as unknown as {
        update: (r: unknown) => {
          eq: (c: string, v: string) => {
            select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
          };
        };
      })
      .update({
        pending_vendor_ids: remaining,
        processed: newProcessed,
        ok: newOk,
        errors: newErrors,
        status: newStatus,
        last_error: lastError,
      })
      .eq("id", job.id)
      .select()
      .single();
    if (uErr) throw new Error(uErr.message);
    return toPublicJob(updated as JobRow);
  });

export const getInstagramBackfillStatus = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<InstagramBackfillJob | null> => {
    try {
      const { isStaff } = await requireUser();
      if (!isStaff) throw new Error("Forbidden: staff only");
      const { data: row, error } = await supabaseAdmin
        .from("instagram_backfill_jobs" as never)
        .select("*")
        .eq("id", data.jobId)
        .maybeSingle();
      if (error) {
        console.error("[instagram-backfill] status read failed", error.message?.slice(0, 200));
        return null;
      }
      return row ? toPublicJob(row as unknown as JobRow) : null;
    } catch (e) {
      // Transient upstream errors (e.g. Cloudflare 522) — let the client keep polling.
      console.error("[instagram-backfill] status handler error", e instanceof Error ? e.message.slice(0, 200) : e);
      return null;
    }
  });
