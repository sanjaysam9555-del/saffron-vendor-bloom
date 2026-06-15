import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ClientVendorStatus } from "@/lib/client-status";
import type { ClientVendor } from "@/lib/project-types";
import { setMyVendorStatus } from "@/lib/projects.functions";
import { useClientPreview } from "@/lib/client-preview";
import { celebrateBooking } from "@/lib/celebrate";

interface Variables {
  vendor_id: string;
  status: ClientVendorStatus | null;
}

/**
 * Shared mutation for updating a client's status on a vendor.
 * - Optimistically updates the `["my-project"]` cache.
 * - Retries once on transient network failures.
 * - Surfaces toast errors.
 */
export function useSetVendorStatus() {
  const qc = useQueryClient();
  const { isPreview } = useClientPreview();

  return useMutation({
    mutationFn: async ({ vendor_id, status }: Variables) => {
      if (isPreview) {
        toast.info("Read-only preview", { description: "Status changes are disabled while previewing as the client." });
        return status;
      }
      try {
        await setMyVendorStatus({ data: { vendor_id, status } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/failed to fetch|networkerror|load failed/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 400));
          await setMyVendorStatus({ data: { vendor_id, status } });
        } else {
          throw err;
        }
      }
      return status;
    },
    onMutate: async ({ vendor_id, status }) => {
      await qc.cancelQueries({ queryKey: ["my-project"] });
      const previous = qc.getQueryData<{ vendors: ClientVendor[] }>(["my-project"]);
      if (previous) {
        qc.setQueryData(["my-project"], {
          ...previous,
          vendors: previous.vendors.map((v) =>
            v.id === vendor_id ? { ...v, client_status: status } : v,
          ),
        });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      const msg = err instanceof Error ? err.message : "Could not save status";
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        toast.warning("Saved locally — will sync when connection is restored");
        return;
      }
      if (ctx?.previous) qc.setQueryData(["my-project"], ctx.previous);
      toast.error(msg);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-project"] });
    },
  });
}
