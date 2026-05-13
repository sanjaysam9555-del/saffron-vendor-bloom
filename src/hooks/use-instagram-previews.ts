import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
    for (const r of rows) existing[r.vendor_id] = r;
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
      // Seed per-vendor cache so the detail drawer renders instantly.
      rows.forEach((p) => {
        qc.setQueryData(["instagram-preview", p.vendor_id, normalizeInstagramHandle(p.handle)], p);
      });
      // Persist for next visit.
      writeLS(rows);
      return rows;
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

  const map = new Map<string, VendorInstagramPreview>();
  (query.data ?? []).forEach((p) => map.set(p.vendor_id, p));
  return { map, isLoading: query.isLoading };
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
      if (row) writeLS([row]);
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
    onSuccess: (data, vars) => {
      if (data) writeLS([data]);
      qc.invalidateQueries({ queryKey: ["instagram-preview", vars.vendorId] });
      qc.invalidateQueries({ queryKey: ["instagram-previews-bulk"] });
    },
  });
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
