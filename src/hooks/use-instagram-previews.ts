import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
  type QueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getVendorInstagramPreviewsBulk,
  refreshVendorInstagramPreview,
  ensureVendorInstagramPreview,
  startInstagramBackfill,
  processInstagramBackfillBatch,
  getInstagramBackfillStatus,
  type VendorInstagramPreview,
  type InstagramBackfillJob,
} from "@/lib/instagram-preview.functions";
import { normalizeInstagramHandle, isValidInstagramHandle } from "@/lib/instagram";

// ---------------------------------------------------------------------------
// localStorage cache — keeps the last known preview for each vendor so the
// strip renders instantly on next visit instead of waiting for the network.
// ---------------------------------------------------------------------------

const LS_KEY = "saffron.ig.previews.v1";
const LS_MAX = 500;
const REFRESH_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

type LSCache = Record<string, VendorInstagramPreview>;

function readLS(): LSCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LSCache) : {};
  } catch {
    return {};
  }
}

function writeLS(rows: VendorInstagramPreview[]) {
  if (typeof window === "undefined") return;
  try {
    const existing = readLS();
    for (const r of rows) {
      const current = existing[r.vendor_id];
      if (current?.status === "ok" && r.status !== "ok") continue;
      existing[r.vendor_id] = r;
    }
    // Cap size by recency of fetched_at.
    const entries = Object.values(existing).sort(
      (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime(),
    );
    const capped: LSCache = {};
    for (const e of entries.slice(0, LS_MAX)) capped[e.vendor_id] = e;
    window.localStorage.setItem(LS_KEY, JSON.stringify(capped));
  } catch {
    /* noop */
  }
}

function readLSForIds(ids: string[]): VendorInstagramPreview[] {
  if (ids.length === 0) return [];
  const cache = readLS();
  const out: VendorInstagramPreview[] = [];
  for (const id of ids) {
    const hit = cache[id];
    if (hit) out.push(hit);
  }
  return out;
}

function findCachedOkPreview(
  qc: QueryClient,
  vendorId: string,
  handle: string | null | undefined,
): VendorInstagramPreview | undefined {
  const normalizedHandle = normalizeInstagramHandle(handle);
  const asTargetVendor = (preview: VendorInstagramPreview) => ({
    ...preview,
    vendor_id: vendorId,
    handle: preview.handle ?? normalizedHandle,
  });

  // 1. Per-vendor cache
  const perVendor = qc.getQueryData<VendorInstagramPreview>([
    "instagram-preview",
    vendorId,
    normalizedHandle,
  ]);
  if (perVendor && perVendor.status === "ok") return asTargetVendor(perVendor);

  // 2. Any other active bulk cache, first by vendor id, then by handle. The
  // admin dashboard can have a working preview cached under another vendor row
  // when duplicate vendor records share the same Instagram profile.
  const bulkCaches = qc.getQueriesData<VendorInstagramPreview[]>({
    queryKey: ["instagram-previews-bulk"],
  });
  for (const [, value] of bulkCaches) {
    const list = Array.isArray(value) ? value : [];
    const hit = list.find((p) => p.vendor_id === vendorId && p.status === "ok");
    if (hit) return asTargetVendor(hit);
    if (normalizedHandle) {
      const handleHit = list.find(
        (p) => p.status === "ok" && normalizeInstagramHandle(p.handle) === normalizedHandle,
      );
      if (handleHit) return asTargetVendor(handleHit);
    }
  }

  // 3. localStorage, also by handle for duplicate vendor records.
  const ls = readLS();
  const fromLS = ls[vendorId];
  if (fromLS && fromLS.status === "ok") return asTargetVendor(fromLS);
  if (normalizedHandle) {
    const handleHit = Object.values(ls).find(
      (p) => p.status === "ok" && normalizeInstagramHandle(p.handle) === normalizedHandle,
    );
    if (handleHit) return asTargetVendor(handleHit);
  }

  return undefined;
}

export function useInstagramPreviewsBulk(vendorIds: string[], options?: { enabled?: boolean }) {
  const fn = useServerFn(getVendorInstagramPreviewsBulk);
  const qc = useQueryClient();
  const sortedKey = [...vendorIds].sort().join(",");

  // Gate on Supabase session readiness — without a bearer token the server fn
  // throws "You're not signed in." and every card silently falls into the
  // empty-state branch.
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session?.access_token) setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) setSessionReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const enabled = (options?.enabled ?? true) && vendorIds.length > 0 && sessionReady;

  const query = useQuery({
    queryKey: ["instagram-previews-bulk", sortedKey],
    queryFn: async () => {
      if (vendorIds.length === 0) return [];
      // Server validator caps each request at 500 ids — chunk for larger lists.
      const CHUNK = 500;
      const chunks: string[][] = [];
      for (let i = 0; i < vendorIds.length; i += CHUNK) {
        chunks.push(vendorIds.slice(i, i + CHUNK));
      }
      const results = await Promise.all(
        chunks.map((ids) => fn({ data: { vendorIds: ids } })),
      );
      const rows = results.flat();
      const resolvedRows = rows.map((p) => {
        if (p.status !== "ok") {
          const cached = findCachedOkPreview(qc, p.vendor_id, p.handle);
          if (cached) return cached;
        }
        return p;
      });
      // Seed per-vendor cache so the detail drawer renders instantly.
      resolvedRows.forEach((p) => {
        qc.setQueryData(["instagram-preview", p.vendor_id, normalizeInstagramHandle(p.handle)], p);
      });
      // Persist for next visit.
      writeLS(resolvedRows);
      return resolvedRows;
    },
    enabled,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // Hydrate from any active bulk cache (covers filter toggles that change
    // the id set) and localStorage so cached strips render on first paint
    // without a refetch flash.
    initialData: () => {
      const idSet = new Set(vendorIds);
      const seen = new Map<string, VendorInstagramPreview>();
      // 1. Any other active bulk-query cache — instant cross-filter reuse.
      const bulkCaches = qc.getQueriesData<VendorInstagramPreview[]>({
        queryKey: ["instagram-previews-bulk"],
      });
      for (const [, value] of bulkCaches) {
        const list = Array.isArray(value) ? value : [];
        for (const row of list) {
          if (idSet.has(row.vendor_id) && !seen.has(row.vendor_id)) {
            seen.set(row.vendor_id, row);
          }
        }
      }
      // 2. Per-vendor cache fallback for ids not in any bulk cache.
      for (const id of vendorIds) {
        if (seen.has(id)) continue;
        const queries = qc.getQueriesData<VendorInstagramPreview>({
          queryKey: ["instagram-preview", id],
        });
        for (const [, row] of queries) {
          if (row && row.vendor_id === id) {
            seen.set(id, row);
            break;
          }
        }
      }
      // 3. localStorage final fallback.
      const fromLS = readLSForIds(vendorIds);
      for (const row of fromLS) {
        if (!seen.has(row.vendor_id)) seen.set(row.vendor_id, row);
      }
      const merged = Array.from(seen.values());
      return merged.length > 0 ? merged : undefined;
    },
    initialDataUpdatedAt: 0, // ensure background refetch still runs
    placeholderData: keepPreviousData,
  });

  // For any vendor whose server row is `error` (e.g. scraper rate-limited),
  // substitute a previously cached `ok` preview from per-vendor cache,
  // other bulk caches, or localStorage. UI-only — not written back to DB.
  const map = new Map<string, VendorInstagramPreview>();
  (query.data ?? []).forEach((p) => {
    if (p.status === "error") {
      const cached = findCachedOkPreview(qc, p.vendor_id, p.handle);
      if (cached) {
        map.set(p.vendor_id, cached);
        return;
      }
    }
    map.set(p.vendor_id, p);
  });
  const hasAllRequestedRows = vendorIds.length === 0 || vendorIds.every((id) => map.has(id));

  // Surface error as "still loading" only while we genuinely have no usable
  // row for the requested cards. Cached rows should keep rendering through
  // filter changes and auth-session warmup.
  return {
    map,
    isLoading: !hasAllRequestedRows && (query.isLoading || (query.isError && !query.data) || !sessionReady),
    isError: query.isError,
  };
}

// ---------------------------------------------------------------------------
// Cache sync — push a freshly-scraped row into every active bulk-query cache
// (and the per-vendor cache + localStorage) so cards refresh instantly when
// the detail drawer or auto-ensure produces a new preview.
// ---------------------------------------------------------------------------

function patchBulkCaches(qc: QueryClient, row: VendorInstagramPreview) {
  const cachedOk =
    row.status === "ok" ? undefined : findCachedOkPreview(qc, row.vendor_id, row.handle);
  const nextRow = cachedOk ?? row;
  // Per-vendor cache
  qc.setQueryData(
    ["instagram-preview", nextRow.vendor_id, normalizeInstagramHandle(nextRow.handle)],
    nextRow,
  );
  // Every active bulk query
  const caches = qc.getQueriesData<VendorInstagramPreview[]>({
    queryKey: ["instagram-previews-bulk"],
  });
  for (const [key, value] of caches) {
    const list = Array.isArray(value) ? value : [];
    const next = list.some((p) => p.vendor_id === nextRow.vendor_id)
      ? list.map((p) => (p.vendor_id === nextRow.vendor_id ? nextRow : p))
      : [...list, nextRow];
    qc.setQueryData(key, next);
  }
  writeLS([nextRow]);
}

export function useEnsureInstagramPreview(vendorId: string, handle: string | null | undefined) {
  const fn = useServerFn(ensureVendorInstagramPreview);
  const qc = useQueryClient();
  const normalized = normalizeInstagramHandle(handle);
  const valid = isValidInstagramHandle(handle);
  return useQuery({
    queryKey: ["instagram-preview", vendorId, normalized],
    queryFn: async () => {
      if (!valid || !normalized) return null;
      const row = await fn({ data: { vendorId, handle: normalized } });
      if (row) patchBulkCaches(qc, row);
      return row;
    },
    enabled: valid,
    staleTime: 5 * 60 * 1000,
    // Seed from the bulk cache or localStorage so the drawer never flashes empty.
    initialData: () => {
      if (!valid) return undefined;
      const fromBulk = qc.getQueryData<VendorInstagramPreview>([
        "instagram-preview",
        vendorId,
        normalized,
      ]);
      if (fromBulk) return fromBulk;
      const fromLS = readLS()[vendorId];
      return fromLS ?? undefined;
    },
    initialDataUpdatedAt: 0,
  });
}

/**
 * Read-only lookup for a vendor's Instagram preview. Returns whatever is
 * already cached (per-vendor query cache → any bulk cache → localStorage)
 * without issuing a network request. Used by detail drawers so opening a
 * vendor never triggers a scrape.
 */
export function useInstagramPreviewFromCache(
  vendorId: string,
  handle: string | null | undefined,
): VendorInstagramPreview | null {
  const qc = useQueryClient();
  const normalized = normalizeInstagramHandle(handle);
  const query = useQuery({
    queryKey: ["instagram-preview", vendorId, normalized],
    queryFn: async () => null as VendorInstagramPreview | null,
    enabled: false,
    initialData: () => {
      const perVendor = qc.getQueryData<VendorInstagramPreview>([
        "instagram-preview",
        vendorId,
        normalized,
      ]);
      if (perVendor) return perVendor;
      const cachedOk = findCachedOkPreview(qc, vendorId, handle);
      if (cachedOk) return cachedOk;
      const fromLS = readLS()[vendorId];
      return fromLS ?? null;
    },
  });
  return query.data ?? findCachedOkPreview(qc, vendorId, handle) ?? readLS()[vendorId] ?? null;
}

export function useRefreshInstagramPreview() {
  const fn = useServerFn(refreshVendorInstagramPreview);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { vendorId: string; handle: string }) => fn({ data: input }),
    onSuccess: (data) => {
      if (data) patchBulkCaches(qc, data);
    },
  });
}

/**
 * Staff-only: for every visible vendor that has an Instagram handle but no
 * cached preview row (or a stale/error one), trigger a background scrape and
 * patch the bulk cache when it returns. Keeps a small in-flight set so we
 * don't fire duplicate requests across re-renders.
 */
export function useAutoEnsureMissingPreviews(
  vendors: Array<{ id: string; instagram_handle: string | null | undefined }>,
  previewMap: Map<string, VendorInstagramPreview>,
) {
  const ensureFn = useServerFn(ensureVendorInstagramPreview);
  const qc = useQueryClient();
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    type Pending = { id: string; handle: string; force: boolean };
    const missing: Pending[] = [];
    for (const v of vendors) {
      const rawHandle = (v.instagram_handle ?? "").trim();
      if (!rawHandle) continue;
      // Skip handles that aren't actually Instagram (e.g. Google Drive
      // links pasted into the field). Scraping them just produces noisy
      // "not_found" rows.
      if (!isValidInstagramHandle(rawHandle)) continue;
      const normalized = normalizeInstagramHandle(rawHandle);
      if (!normalized) continue;
      if (inFlight.current.has(v.id)) continue;

      const existing = previewMap.get(v.id);
      if (existing && existing.status === "ok") {
        // Rows that still point at the Instagram CDN carry expiring signed
        // URLs — re-scrape so the persistence step can mirror them into our
        // cache bucket and the thumbnails stop going blank.
        const stillEphemeral = [existing.avatar_url, ...(existing.post_thumbnails ?? [])].some(
          (u) => !!u && /(cdninstagram\.com|fbcdn\.net)/i.test(u),
        );
        if (stillEphemeral) {
          missing.push({ id: v.id, handle: normalized, force: false });
          continue;
        }
        const ageMs = Date.now() - new Date(existing.fetched_at).getTime();
        if (ageMs <= REFRESH_AFTER_MS) continue;
        missing.push({ id: v.id, handle: normalized, force: false });
        continue;
      }
      // No row, or only an error/not_found row.
      const cachedOk = findCachedOkPreview(qc, v.id, normalized);
      if (cachedOk) continue;
      // If the cached row's handle no longer matches the normalized
      // handle, it was scraped with a bad value (legacy URL-as-handle).
      // Force a rescrape past the server cooldown.
      const force =
        !!existing &&
        existing.status !== "ok" &&
        normalizeInstagramHandle(existing.handle) !== normalized;
      missing.push({ id: v.id, handle: normalized, force });
    }

    if (missing.length === 0) return;

    let cancelled = false;
    // Defer past first paint so the cards render immediately and the
    // background scraping never blocks navigation or interaction.
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const startDelay = (cb: () => void) => {
      if (typeof win.requestIdleCallback === "function") {
        win.requestIdleCallback(cb, { timeout: 2000 });
      } else {
        window.setTimeout(cb, 1200);
      }
    };

    const CONCURRENCY = 6;
    let cursor = 0;

    async function worker() {
      while (!cancelled && cursor < missing.length) {
        const v = missing[cursor++];
        inFlight.current.add(v.id);
        try {
          const row = await ensureFn({
            data: { vendorId: v.id, handle: v.handle, force: v.force },
          });
          if (row && !cancelled) patchBulkCaches(qc, row);
        } catch {
          /* swallow — scraper failures are tracked in last_error */
        } finally {
          inFlight.current.delete(v.id);
        }
      }
    }

    startDelay(() => {
      if (cancelled) return;
      const workers = Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () => worker());
      void Promise.all(workers);
    });

    return () => {
      cancelled = true;
    };
  }, [vendors, previewMap, ensureFn, qc]);
}

/**
 * Fire-and-forget scrape for a single vendor (e.g. right after creation).
 * Returns a stable callback safe to call from event handlers.
 *
 * After the scrape resolves we also invalidate the bulk-preview query so
 * any list mounted under a *different* query key (e.g. the vendor list that
 * just re-fetched with the new vendor id) picks up the freshly stored row.
 * If the first attempt returns a non-`ok` row (Apify often warms up slowly
 * for brand-new handles), retry once with `force: true` after ~12s.
 */
export function useTriggerInstagramPreview() {
  const ensureFn = useServerFn(ensureVendorInstagramPreview);
  const qc = useQueryClient();
  return (vendorId: string, handle: string | null | undefined) => {
    if (!isValidInstagramHandle(handle)) return;
    const h = normalizeInstagramHandle(handle);
    if (!h) return;

    const propagate = (row: VendorInstagramPreview | null | undefined) => {
      if (row) patchBulkCaches(qc, row);
      // Invalidate every bulk-preview query so lists fetched under a new
      // key (added vendor id changes the sortedKey) pick up the new row.
      qc.invalidateQueries({ queryKey: ["instagram-previews-bulk"] });
    };

    void ensureFn({ data: { vendorId, handle: h, force: true } })
      .then((row) => {
        propagate(row);
        if (!row || row.status !== "ok") {
          // One delayed retry for slow-to-warm-up Apify scrapes.
          window.setTimeout(() => {
            void ensureFn({ data: { vendorId, handle: h, force: true } })
              .then(propagate)
              .catch(() => {
                /* noop */
              });
          }, 12000);
        }
      })
      .catch(() => {
        /* noop */
      });
  };
}

export function useStartInstagramBackfill() {
  const fn = useServerFn(startInstagramBackfill);
  return useMutation({
    mutationFn: (input: { mode: "missing_or_stale" | "all" }) => fn({ data: input }),
  });
}

export function useProcessInstagramBackfillBatch() {
  const fn = useServerFn(processInstagramBackfillBatch);
  return useMutation({
    mutationFn: (input: { jobId: string }) => fn({ data: input }),
  });
}

export function useInstagramBackfillStatus(jobId: string | null) {
  const fn = useServerFn(getInstagramBackfillStatus);
  return useQuery({
    queryKey: ["instagram-backfill-status", jobId],
    queryFn: () => (jobId ? fn({ data: { jobId } }) : Promise.resolve(null)),
    enabled: !!jobId,
    refetchInterval: 2000,
  });
}

export type { InstagramBackfillJob };
