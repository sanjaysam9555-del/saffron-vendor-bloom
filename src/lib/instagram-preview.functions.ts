import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthToken } from "./auth-client-middleware";
import { scrapeInstagramProfile } from "@/server/instagram-preview.server";
import { persistInstagramAssets } from "@/server/instagram-image-cache.server";

/** True if any of `urls` still references an Instagram CDN host (signed + expiring). */
function hasEphemeralCdnUrl(urls: Array<string | null | undefined>): boolean {
  return urls.some((u) => !!u && /(cdninstagram\.com|fbcdn\.net)/i.test(u));
}

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

const STALE_DAYS = 3;

async function requireUser(): Promise<{ userId: string; isStaff: boolean }> {
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

async function upsertPreview(
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
    .from("vendor_instagram_previews" as never) as unknown as {
      upsert: (r: unknown, opts: { onConflict: string }) => {
        select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    })
    .upsert(row, { onConflict: "vendor_id" })
    .select()
    .single();
  if (error) {
    console.error("[instagram-preview] upsert failed", error.message);
    return null;
  }
  return data as unknown as VendorInstagramPreview;
}

async function mirrorExistingPreviewAssets(
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
    .from("vendor_instagram_previews" as never) as unknown as {
      upsert: (r: unknown, opts: { onConflict: string }) => {
        select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    })
    .upsert(next, { onConflict: "vendor_id" })
    .select()
    .single();
  if (error) {
    console.error("[instagram-preview] mirror upsert failed", error.message);
    return row;
  }
  return data as unknown as VendorInstagramPreview;
}

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
        // URLs into our cache bucket and return immediately.
        return mirrorExistingPreviewAssets(data.vendorId, row);
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

export interface InstagramBackfillJob {
  id: string;
  status: "running" | "done" | "error";
  total: number;
  processed: number;
  ok: number;
  errors: number;
  pending_count: number;
  last_error: string | null;
  started_at: string;
  updated_at: string;
}

const BATCH_SIZE = 3;

type JobRow = {
  id: string;
  status: string;
  total: number;
  processed: number;
  ok: number;
  errors: number;
  pending_vendor_ids: string[];
  last_error: string | null;
  started_at: string;
  updated_at: string;
};

function toPublicJob(row: JobRow): InstagramBackfillJob {
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

export const startInstagramBackfill = createServerFn({ method: "POST" })
  .middleware([attachAuthToken])
  .inputValidator((d) =>
    z.object({ mode: z.enum(["missing_or_stale", "all"]).default("missing_or_stale") }).parse(d),
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
