import { useEffect, useRef } from "react";
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
} from "@/server/instagram-preview.functions";
import { normalizeInstagramHandle } from "@/lib/instagram";

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
  // 1. Per-vendor cache
  const perVendor = qc.getQueryData<VendorInstagramPreview>([
    "instagram-preview",
    vendorId,
    normalizeInstagramHandle(handle),
  ]);
  if (perVendor && perVendor.status === "ok") return perVendor;

  // 2. Any other active bulk cache
  const bulkCaches = qc.getQueriesData<VendorInstagramPreview[]>({
    queryKey: ["instagram-previews-bulk"],
  });
  for (const [, value] of bulkCaches) {
    const list = Array.isArray(value) ? value : [];
    const hit = list.find((p) => p.vendor_id === vendorId && p.status === "ok");
    if (hit) return hit;
  }

  // 3. localStorage
  const fromLS = readLS()[vendorId];
  if (fromLS && fromLS.status === "ok") return fromLS;

  return undefined;
}

export function useInstagramPreviewsBulk(vendorIds: string[], options?: { enabled?: boolean }) {
  const fn = useServerFn(getVendorInstagramPreviewsBulk);
  const qc = useQueryClient();
  const sortedKey = [...vendorIds].sort().join(",");
  const enabled = (options?.enabled ?? true) && vendorIds.length > 0;

  const query = useQuery({
    queryKey: ["instagram-previews-bulk", sortedKey],
    queryFn: async () => {
      if (vendorIds.length === 0) return [];
      const rows = await fn({ data: { vendorIds } });
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
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // Hydrate from localStorage so cached strips render on first paint.
    initialData: () => {
      const cached = readLSForIds(vendorIds);
      return cached.length > 0 ? cached : undefined;
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
  return { map, isLoading: query.isLoading };
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
  return useQuery({
    queryKey: ["instagram-preview", vendorId, normalized],
    queryFn: async () => {
      if (!handle) return null;
      const row = await fn({ data: { vendorId, handle } });
      if (row) patchBulkCaches(qc, row);
      return row;
    },
    enabled: !!handle,
    staleTime: 5 * 60 * 1000,
    // Seed from the bulk cache or localStorage so the drawer never flashes empty.
    initialData: () => {
      if (!handle) return undefined;
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
    const missing = vendors.filter((v) => {
      const handle = (v.instagram_handle ?? "").trim();
      if (!handle) return false;
      if (inFlight.current.has(v.id)) return false;
      const existing = previewMap.get(v.id);
      if (existing && existing.status === "ok") {
        const ageMs = Date.now() - new Date(existing.fetched_at).getTime();
        return ageMs > REFRESH_AFTER_MS;
      }
      // No row, or only an error row — but if we have a cached ok elsewhere,
      // don't re-scrape (avoids wasting scraper quota when previewMap was
      // substituted from cache).
      const cachedOk = findCachedOkPreview(qc, v.id, handle);
      if (cachedOk) return false;
      return true;
    });

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
        const handle = (v.instagram_handle ?? "").trim();
        if (!handle) continue;
        inFlight.current.add(v.id);
        try {
          const row = await ensureFn({ data: { vendorId: v.id, handle } });
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
 */
export function useTriggerInstagramPreview() {
  const ensureFn = useServerFn(ensureVendorInstagramPreview);
  const qc = useQueryClient();
  return (vendorId: string, handle: string | null | undefined) => {
    const h = (handle ?? "").trim();
    if (!h) return;
    void ensureFn({ data: { vendorId, handle: h } })
      .then((row) => {
        if (row) patchBulkCaches(qc, row);
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
