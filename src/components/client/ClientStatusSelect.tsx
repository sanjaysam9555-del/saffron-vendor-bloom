import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const handleSelect = (next: ClientVendorStatus | null) => {
    if (next === status) return;
    mutation.mutate(next);
  };

  // Distinct, vibrant trigger styling so it stands out from category tags.
  const triggerBase =
    "inline-flex items-center justify-between gap-2 rounded-md border-2 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all hover:shadow active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
  const triggerStyle = current
    ? `${current.pill} border-transparent ring-1 ring-black/5`
    : "bg-[var(--charcoal)] text-[var(--cream)] border-[var(--charcoal)] hover:bg-[var(--charcoal)]/90";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={compact ? "inline-flex" : "w-full"}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          asChild
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`${triggerBase} ${triggerStyle} ${compact ? "" : "w-full"}`}
          >
            <span className="flex items-center gap-2 truncate">
              {current && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: current.dot }}
                />
              )}
              <span className="truncate">
                {current ? current.label : "Set your status"}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="z-[60] min-w-[12rem]"
          onClick={(e) => e.stopPropagation()}
        >
          {CLIENT_STATUS_OPTIONS.map((opt) => {
            const active = opt.value === status;
            return (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => handleSelect(opt.value)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.dot }}
                  />
                  {opt.label}
                </span>
                {active && <Check className="h-3.5 w-3.5 opacity-70" />}
              </DropdownMenuItem>
            );
          })}
          {status && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleSelect(null)}
                className="text-[var(--charcoal)]/70"
              >
                <X className="mr-2 h-3.5 w-3.5" /> Clear status
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
