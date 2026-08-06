import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, Star, X } from "lucide-react";
import { useVendors } from "@/hooks/useVendorData";
import { useEnsureInstagramPreview } from "@/hooks/use-instagram-previews";
import { assignVendorToProject } from "@/lib/projects.functions";
import { notifyError, notifySuccess } from "@/lib/ui/feedback";
import { Instagram } from "lucide-react";
import type { VendorInstagramPreview as PreviewData } from "@/lib/instagram-preview.functions";
import type { Vendor } from "@/lib/vendor-types";

interface Props {
  projectId: string;
  assignedVendorIds: Set<string>;
  /** Overrides the outer wrapper's sizing/spacing classes. */
  className?: string;
}

export function QuickAddVendorPanel({ projectId, assignedVendorIds, className }: Props) {
  const qc = useQueryClient();
  
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
    <div className={`relative ${className ?? "mb-4"}`}>
      <div className="flex h-[30px] items-center gap-2 rounded-md border border-[var(--border)] bg-white px-2.5 text-xs">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--charcoal)]/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Add vendors…"
          className="w-full bg-transparent text-xs placeholder:text-[var(--charcoal)]/60 focus:outline-none"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="rounded p-0.5 text-[var(--charcoal)]/50 hover:bg-[var(--cream)] hover:text-[var(--charcoal)]"
            title="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Absolutely positioned so a narrow trigger (this panel now sits in a
          toolbar row, not full-width) doesn't cramp the result rows. */}
      {q.trim() && (
        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-[360px] w-full min-w-[340px] overflow-y-auto rounded-lg border border-[var(--border)] bg-white p-2 shadow-lg">
          {isLoading ? (
            <div className="px-2 py-6 text-center text-xs text-[var(--charcoal)]/55">
              Loading vendor library…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-[var(--charcoal)]/55">
              No vendors match “{q}”.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {filtered.map((v) => (
                <QuickAddVendorRow
                  key={v.id}
                  vendor={v}
                  alreadyAssigned={assignedVendorIds.has(v.id) || justAdded.has(v.id)}
                  isPending={pendingId === v.id}
                  onAdd={() => handleAdd(v.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  vendor: Vendor;
  alreadyAssigned: boolean;
  isPending: boolean;
  onAdd: () => void;
}

function QuickAddVendorRow({ vendor: v, alreadyAssigned, isPending, onAdd }: RowProps) {
  const hasHandle = !!(v.instagram_handle && v.instagram_handle.trim());
  const { data: preview } = useEnsureInstagramPreview(v.id, v.instagram_handle);

  return (
    <li className="rounded-md border border-[var(--border)] bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
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
            onClick={onAdd}
            disabled={isPending}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--terracotta)] bg-[var(--terracotta)] px-2.5 py-1 text-[11px] font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-60"
          >
            <Plus className="h-3 w-3" />
            {isPending ? "Adding…" : "Add to this project"}
          </button>
        )}
      </div>

      {hasHandle && <CompactInstagramStrip preview={preview} />}
    </li>
  );
}

function igProxy(src: string): string {
  if (/^https?:\/\/[^/]*(cdninstagram\.com|fbcdn\.net)/i.test(src)) {
    return `/api/public/instagram-image?url=${encodeURIComponent(src)}`;
  }
  return src;
}

function CompactInstagramStrip({ preview }: { preview: PreviewData | null | undefined }) {
  if (preview === undefined) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-5 w-5 animate-pulse rounded-full bg-[var(--cream-deep)]" />
        <div className="h-2 w-20 animate-pulse rounded bg-[var(--cream-deep)]" />
      </div>
    );
  }
  if (!preview) return null;
  const thumbs = (preview.post_thumbnails ?? []).slice(0, 4);
  const handle = preview.handle ?? "";
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {preview.avatar_url ? (
        <img
          src={igProxy(preview.avatar_url)}
          alt=""
          referrerPolicy="no-referrer"
          className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
        />
      ) : (
        <Instagram className="h-3 w-3 shrink-0 text-[var(--terracotta)]" />
      )}
      {handle && (
        <span className="truncate text-[10px] text-[var(--charcoal)]/65">@{handle}</span>
      )}
      {thumbs.length > 0 && (
        <div className="ml-auto flex gap-0.5">
          {thumbs.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={igProxy(src)}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-sm object-cover bg-[var(--cream-deep)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
