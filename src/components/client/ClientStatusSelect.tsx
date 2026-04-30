import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CLIENT_STATUS_OPTIONS,
  getClientStatusOption,
  type ClientVendorStatus,
} from "@/lib/client-status";
import type { ClientVendor } from "@/lib/project-types";
import { setMyVendorStatus } from "@/server/projects.functions";

interface Props {
  vendorId: string;
  status: ClientVendorStatus | null;
  /** Compact variant for use inside the card grid. */
  compact?: boolean;
}

export function ClientStatusSelect({ vendorId, status, compact = false }: Props) {
  const qc = useQueryClient();
  const current = getClientStatusOption(status);

  const mutation = useMutation({
    mutationFn: async (next: ClientVendorStatus | null) => {
      await setMyVendorStatus({ data: { vendor_id: vendorId, status: next } });
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["my-project"] });
      const previous = qc.getQueryData<{ vendors: ClientVendor[] }>([
        "my-project",
      ]);
      if (previous) {
        qc.setQueryData(["my-project"], {
          ...previous,
          vendors: previous.vendors.map((v) =>
            v.id === vendorId ? { ...v, client_status: next } : v,
          ),
        });
      }
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(["my-project"], ctx.previous);
      toast.error(err instanceof Error ? err.message : "Could not save status");
    },
  });

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const value = e.target.value;
    const next = value === "" ? null : (value as ClientVendorStatus);
    mutation.mutate(next);
  };

  const accent = current?.dot ?? "var(--charcoal)";
  const valueAttr = status ?? "";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative inline-flex items-center ${compact ? "" : "w-full"}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 h-2 w-2 rounded-full"
        style={{ backgroundColor: current ? accent : "transparent", border: current ? "none" : "1px dashed var(--border)" }}
      />
      <select
        value={valueAttr}
        onChange={onChange}
        disabled={mutation.isPending}
        className={`appearance-none rounded-md border border-[var(--border)] bg-white pl-5 pr-7 py-1.5 text-xs font-medium text-[var(--charcoal)] hover:border-[var(--terracotta)] focus:border-[var(--terracotta)] focus:outline-none disabled:opacity-60 ${compact ? "" : "w-full"}`}
        title={current?.label ?? "Set your status for this vendor"}
      >
        <option value="">Set status…</option>
        {CLIENT_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-2 h-3 w-3 text-[var(--charcoal)]/50"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
