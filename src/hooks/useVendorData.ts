import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  bulkUpdateVendors,
  bulkDeleteVendors,
  bulkInsertVendors,
} from "@/lib/vendor-api";
import type { Vendor, VendorInput } from "@/lib/vendor-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useVendors() {
  const qc = useQueryClient();
  const { session, initialized, role } = useAuth();
  const isStaff = role === "admin" || role === "employee";
  const query = useQuery({
    queryKey: ["vendors", session?.user?.id ?? null],
    queryFn: listVendors,
    // Only fetch once auth is initialized and the user has a staff role —
    // prevents 403/race traffic during sign-in and on cold loads.
    enabled: initialized && !!session?.access_token && isStaff,
  });

  // Live updates: subscribe AFTER the first vendor load completes, and
  // debounce invalidations so a burst of edits causes one refetch.
  const ready = isStaff && !!query.data;
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    const invalidate = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["vendors"] });
      }, 250);
    };
    const channel = supabase
      .channel("vendors-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        invalidate,
      )
      .subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc, ready]);

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
  const bulkInsert = useMutation({
    mutationFn: (rows: VendorInput[]) => bulkInsertVendors(rows),
    onSuccess: invalidate,
  });

  return { create, update, remove, bulkUpdate, bulkDelete, bulkInsert };
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

// Defers a heavy effect to browser idle time (or a 400ms fallback) so the
// initial paint isn't blocked by decorative work like Instagram previews.
export function useIdleReady(): boolean {
  const [ready, setReady] = useState(false);
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const mark = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setReady(true);
    };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(mark, { timeout: 1200 });
    } else {
      window.setTimeout(mark, 400);
    }
  }, []);
  return ready;
}
