import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  bulkUpdateVendors,
  bulkDeleteVendors,
} from "@/lib/vendor-api";
import type { Vendor, VendorInput } from "@/lib/vendor-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useVendors() {
  const qc = useQueryClient();
  const { session, initialized } = useAuth();
  const query = useQuery({
    queryKey: ["vendors", session?.user?.id ?? null],
    queryFn: listVendors,
    // Wait until Supabase has restored the session from storage AND we have
    // a valid bearer token. Prevents the "session expired" race on cold loads
    // (especially the iPad PWA reopening after being backgrounded).
    enabled: initialized && !!session?.access_token,
  });

  // Live updates: subscribe to any change on the vendors table and
  // invalidate the cache so the dashboard reflects edits/adds/deletes
  // made from any device without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel("vendors-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        () => {
          qc.invalidateQueries({ queryKey: ["vendors"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useVendorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendors"] });

  const create = useMutation({ mutationFn: createVendor, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<VendorInput> }) => updateVendor(id, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteVendor, onSuccess: invalidate });

  const bulkUpdate = useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: Partial<VendorInput> }) =>
      bulkUpdateVendors(ids, patch),
    onSuccess: invalidate,
  });
  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteVendors(ids),
    onSuccess: invalidate,
  });

  return { create, update, remove, bulkUpdate, bulkDelete };
}

export interface VendorModalState {
  detail: Vendor | null;
  formOpen: boolean;
  editing: Vendor | null;
  prefill: Partial<VendorInput> | null;
}

export function useVendorModals() {
  const [state, setState] = useState<VendorModalState>({
    detail: null, formOpen: false, editing: null, prefill: null,
  });
  return {
    state,
    openDetail: (v: Vendor) => setState({ detail: v, formOpen: false, editing: null, prefill: null }),
    closeDetail: () => setState((s) => ({ ...s, detail: null })),
    openCreate: (prefill?: Partial<VendorInput>) =>
      setState({ detail: null, formOpen: true, editing: null, prefill: prefill ?? null }),
    openEdit: (v: Vendor) => setState({ detail: null, formOpen: true, editing: v, prefill: null }),
    closeForm: () => setState((s) => ({ ...s, formOpen: false, editing: null, prefill: null })),
  };
}
