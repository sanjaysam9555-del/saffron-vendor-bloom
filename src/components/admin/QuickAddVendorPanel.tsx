import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, Search, Star, X } from "lucide-react";
import { useVendors } from "@/hooks/useVendorData";
import { useEnsureInstagramPreview } from "@/hooks/use-instagram-previews";
import { assignVendorToProject } from "@/lib/projects.functions";
import { notifyError, notifySuccess } from "@/lib/ui/feedback";
import { VendorInstagramCardStrip } from "@/components/vendor/VendorInstagramPreview";
import type { Vendor } from "@/lib/vendor-types";

interface Props {
  projectId: string;
  assignedVendorIds: Set<string>;
}

export function QuickAddVendorPanel({ projectId, assignedVendorIds }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useVendors();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [] as Vendor[];
    return (vendors as Vendor[])
      .filter((v) => {
        const hay = [v.vendor_name, v.category, v.subcategory, v.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 25);
  }, [q, vendors]);

  const addMutation = useMutation({
    mutationFn: async (vendor_id: string) => {
      await assignVendorToProject({ data: { project_id: projectId, vendor_id } });
      return vendor_id;
    },
    onSuccess: (vendor_id) => {
      setJustAdded((s) => new Set(s).add(vendor_id));
      notifySuccess("Vendor added to this project");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["vendor-project-assignments"] });
    },
    onError: (err) => notifyError(err, "Could not add vendor"),
    onSettled: () => setPendingId(null),
  });

  const handleAdd = (vendor_id: string) => {
    setPendingId(vendor_id);
    addMutation.mutate(vendor_id);
  };

  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--charcoal)]">
          <Plus className="h-4 w-4 text-[var(--terracotta)]" />
          Quick add vendor
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--charcoal)]/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--cream)]/40 px-2.5 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--charcoal)]/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by vendor name, category, subcategory, location…"
              className="w-full bg-transparent text-sm focus:outline-none"
              autoFocus
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="rounded p-0.5 text-[var(--charcoal)]/50 hover:bg-white hover:text-[var(--charcoal)]"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 max-h-[360px] overflow-y-auto">
            {!q.trim() ? (
              <div className="px-2 py-6 text-center text-xs text-[var(--charcoal)]/55">
                {isLoading ? "Loading vendor library…" : "Type to search the vendor library."}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-[var(--charcoal)]/55">
                No vendors match “{q}”.
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filtered.map((v) => {
                  const alreadyAssigned =
                    assignedVendorIds.has(v.id) || justAdded.has(v.id);
                  const isPending = pendingId === v.id;
                  return (
                    <li
                      key={v.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--charcoal)]/55">
                          {v.category}
                          {v.subcategory ? ` · ${v.subcategory}` : ""}
                        </div>
                        <div className="truncate text-sm font-medium text-[var(--charcoal)]">
                          {v.vendor_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--charcoal)]/65">
                          {v.location && <span>{v.location}</span>}
                          {v.price_text && (
                            <span className="text-[var(--terracotta)]">{v.price_text}</span>
                          )}
                          {v.google_rating != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-current text-amber-500" />
                              {v.google_rating}
                            </span>
                          )}
                          {v.saffron_rating != null && (
                            <span className="inline-flex items-center gap-0.5 text-[var(--terracotta)]">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              {v.saffron_rating}
                            </span>
                          )}
                        </div>
                      </div>

                      {alreadyAssigned ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--cream)] px-2.5 py-1 text-[11px] font-medium text-[var(--charcoal)]/60">
                          <Check className="h-3 w-3" /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAdd(v.id)}
                          disabled={isPending}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--terracotta)] bg-[var(--terracotta)] px-2.5 py-1 text-[11px] font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-60"
                        >
                          <Plus className="h-3 w-3" />
                          {isPending ? "Adding…" : "Add to this project"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
