import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getVendorInstagramPreviewsBulk,
  refreshVendorInstagramPreview,
  ensureVendorInstagramPreview,
  type VendorInstagramPreview,
} from "@/server/instagram-preview.functions";
import { normalizeInstagramHandle } from "@/lib/instagram";

export function useInstagramPreviewsBulk(vendorIds: string[]) {
  const fn = useServerFn(getVendorInstagramPreviewsBulk);
  const qc = useQueryClient();
  const sortedKey = [...vendorIds].sort().join(",");
  const query = useQuery({
    queryKey: ["instagram-previews-bulk", sortedKey],
    queryFn: async () => {
      if (vendorIds.length === 0) return [];
      const rows = await fn({ data: { vendorIds } });
      // Seed per-vendor cache so the detail drawer renders instantly.
      rows.forEach((p) => {
        qc.setQueryData(["instagram-preview", p.vendor_id, normalizeInstagramHandle(p.handle)], p);
      });
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });
  const map = new Map<string, VendorInstagramPreview>();
  (query.data ?? []).forEach((p) => map.set(p.vendor_id, p));
  return { map, isLoading: query.isLoading };
}

export function useEnsureInstagramPreview(vendorId: string, handle: string | null | undefined) {
  const fn = useServerFn(ensureVendorInstagramPreview);
  return useQuery({
    queryKey: ["instagram-preview", vendorId, handle],
    queryFn: async () => {
      if (!handle) return null;
      return fn({ data: { vendorId, handle } });
    },
    enabled: !!handle,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshInstagramPreview() {
  const fn = useServerFn(refreshVendorInstagramPreview);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { vendorId: string; handle: string }) => fn({ data: input }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["instagram-preview", vars.vendorId] });
      qc.invalidateQueries({ queryKey: ["instagram-previews-bulk"] });
    },
  });
}
