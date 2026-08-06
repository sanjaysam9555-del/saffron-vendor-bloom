import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProjectCommentsAllVendors, addStaffVendorComment } from "@/lib/projects.functions";
import { notifyError } from "@/lib/ui/feedback";

export function ProjectCommentsTab({
  projectId,
  onOpenVendor,
}: {
  projectId: string;
  onOpenVendor?: (vendorId: string) => void;
}) {
  const qc = useQueryClient();
  const key = ["project-comments-all", projectId];
  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listProjectCommentsAllVendors({ data: { project_id: projectId } }),
  });

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendorName: string; items: typeof comments }>();
    for (const c of comments) {
      const entry = map.get(c.vendor_id) ?? { vendorName: c.vendor_name, items: [] };
      entry.items.push(c);
      map.set(c.vendor_id, entry);
    }
    return Array.from(map.entries()).map(([vendorId, v]) => ({ vendorId, ...v }));
  }, [comments]);

  if (isLoading) {
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-[var(--charcoal)]/50">Loading…</div>;
  }

  if (byVendor.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/50">
        No comments yet on any vendor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byVendor.map(({ vendorId, vendorName, items }) => (
        <VendorCommentGroup
          key={vendorId}
          projectId={projectId}
          vendorId={vendorId}
          vendorName={vendorName}
          items={items}
          onPosted={() => qc.invalidateQueries({ queryKey: key })}
          onOpenVendor={onOpenVendor}
        />
      ))}
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function VendorCommentGroup({
  projectId,
  vendorId,
  vendorName,
  items,
  onPosted,
  onOpenVendor,
}: {
  projectId: string;
  vendorId: string;
  vendorName: string;
  items: Array<{ id: string; body: string; created_at: string; author_role: "staff" | "client"; author_name: string }>;
  onPosted: () => void;
  onOpenVendor?: (vendorId: string) => void;
}) {
  const [reply, setReply] = useState("");
  const post = useMutation({
    mutationFn: () => addStaffVendorComment({ data: { project_id: projectId, vendor_id: vendorId, body: reply.trim() } }),
    onSuccess: () => {
      setReply("");
      onPosted();
    },
    onError: (e) => notifyError(e, "Could not post reply"),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onOpenVendor?.(vendorId)}
        disabled={!onOpenVendor}
        className="block w-full border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--cream)]/40 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/45">Allocation</div>
        <h3 className="font-display text-lg text-[var(--charcoal)] hover:text-[var(--terracotta)]">{vendorName}</h3>
      </button>
      <div className="space-y-2 p-4">
        {items.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5 rounded-lg bg-[var(--cream)]/50 p-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${
                c.author_role === "staff" ? "bg-[var(--terracotta)]" : "bg-[var(--charcoal)]"
              }`}
            >
              {c.author_role === "staff" ? "P" : "C"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--charcoal)]">{c.body}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/40">
                {c.author_role === "staff" ? "Planner" : "Client"} · {timeAgo(c.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!reply.trim()) return;
          post.mutate();
        }}
        className="flex items-center gap-2 border-t border-[var(--border)] p-3"
      >
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply…"
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--cream)]/50 px-3 py-1.5 text-sm focus:border-[var(--terracotta)] focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!reply.trim() || post.isPending}
          className="rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
