import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Pencil } from "lucide-react";
import { listProjectQuotesAllVendors } from "@/lib/quote-api";
import { formatINR, ordinal, buildQuoteSeqMap, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/quote-types";

const STATUS_CLS: Record<QuoteStatus, string> = {
  received: "bg-[var(--cream-deep)] text-[var(--charcoal)]/70",
  revised: "bg-[var(--terracotta-soft)] text-[var(--terracotta)]",
  closed: "bg-emerald-100 text-emerald-800",
  withdrawn: "bg-[var(--charcoal)]/10 text-[var(--charcoal)]/45 line-through",
};

const STATUS_ORDER: QuoteStatus[] = ["received", "revised", "closed", "withdrawn"];
type SortMode = "newest" | "oldest" | "amount_desc" | "amount_asc";

function quoteAmount(q: { status: QuoteStatus; is_final: boolean; closed_amount: number | null; quote_amount: number | null }) {
  const closed = q.is_final || q.status === "closed";
  return (closed && q.closed_amount != null ? q.closed_amount : q.quote_amount) ?? 0;
}

/**
 * Grouped by vendor, same shape as the Assigned Vendors card list. Clicking
 * any quote opens that vendor's quotes panel — the same panel every other
 * "view quotes" entry point in the app already opens (VendorQuotesPill, the
 * Assigned Vendors card, the Table view) — so it edits, not just displays.
 */
export function ProjectQuotesTab({
  projectId,
  onOpenVendorQuotes,
}: {
  projectId: string;
  onOpenVendorQuotes?: (vendorId: string, vendorName: string, category: string | null) => void;
}) {
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["project-quotes-all", projectId],
    queryFn: () => listProjectQuotesAllVendors(projectId),
  });

  const [statusFilter, setStatusFilter] = useState<Set<QuoteStatus>>(new Set());
  const [sort, setSort] = useState<SortMode>("newest");

  const filtered = useMemo(
    () => (statusFilter.size === 0 ? quotes : quotes.filter((q) => statusFilter.has(q.status))),
    [quotes, statusFilter],
  );

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendorName: string; category: string | null; quotes: typeof filtered }>();
    for (const q of filtered) {
      const entry = map.get(q.vendor_id) ?? { vendorName: q.vendor_name, category: q.category, quotes: [] };
      entry.quotes.push(q);
      map.set(q.vendor_id, entry);
    }
    const groups = Array.from(map.entries()).map(([vendorId, v]) => ({ vendorId, ...v }));
    groups.sort((a, b) => {
      if (sort === "newest") return b.quotes[0]?.created_at.localeCompare(a.quotes[0]?.created_at ?? "") ?? 0;
      if (sort === "oldest") return a.quotes[0]?.created_at.localeCompare(b.quotes[0]?.created_at ?? "") ?? 0;
      const aMax = Math.max(...a.quotes.map(quoteAmount));
      const bMax = Math.max(...b.quotes.map(quoteAmount));
      return sort === "amount_desc" ? bMax - aMax : aMax - bMax;
    });
    return groups;
  }, [filtered, sort]);

  const bookedCount = byVendor.filter((v) => v.quotes.some((q) => q.is_final || q.status === "closed")).length;
  const totalClosed = quotes
    .filter((q) => q.is_final || q.status === "closed")
    .reduce((sum, q) => sum + Number(q.closed_amount ?? q.quote_amount ?? 0), 0);
  const openCount = quotes.filter((q) => !(q.is_final || q.status === "closed") && q.status !== "withdrawn").length;

  const toggleStatus = (s: QuoteStatus) =>
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  if (isLoading) {
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-[var(--charcoal)]/50">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Booked vendors" value={String(bookedCount)} />
        <StatCard label="Total closed spend" value={formatINR(totalClosed)} />
        <StatCard label="Open quotes" value={String(openCount)} />
      </div>

      {/* ── Filter + sort ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_ORDER.map((s) => {
            const active = statusFilter.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  active
                    ? "bg-[var(--terracotta)] text-[var(--cream)]"
                    : "border border-[var(--border)] bg-white text-[var(--charcoal)]/65 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                }`}
              >
                {QUOTE_STATUS_LABEL[s]}
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button
              onClick={() => setStatusFilter(new Set())}
              className="text-[11px] text-[var(--terracotta)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/75 focus:border-[var(--terracotta)] focus:outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount_desc">Highest value</option>
          <option value="amount_asc">Lowest value</option>
        </select>
      </div>

      {byVendor.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/50">
          {quotes.length === 0 ? "No quotes yet on this project." : "No quotes match this filter."}
        </div>
      ) : (
        <div className="lg:columns-2 lg:gap-4">
          {byVendor.map(({ vendorId, vendorName, category, quotes: vqs }) => {
            const seqMap = buildQuoteSeqMap(vqs);
            const booked = vqs.some((q) => q.is_final || q.status === "closed");
            return (
              <div key={vendorId} className="mb-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm break-inside-avoid">
                <button
                  onClick={() => onOpenVendorQuotes?.(vendorId, vendorName, category)}
                  disabled={!onOpenVendorQuotes}
                  className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--cream)]/40 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div>
                    <h3 className="font-display text-lg text-[var(--charcoal)] hover:text-[var(--terracotta)]">{vendorName}</h3>
                    <p className="text-xs text-[var(--charcoal)]/50">
                      {vqs.length} quote{vqs.length === 1 ? "" : "s"}{booked ? " · Booked" : ""}
                    </p>
                  </div>
                  {onOpenVendorQuotes && <Pencil className="h-3.5 w-3.5 shrink-0 text-[var(--charcoal)]/30" />}
                </button>
                <div className="divide-y divide-[var(--border)]">
                  {vqs.map((q) => {
                    const closed = q.is_final || q.status === "closed";
                    const amt = closed && q.closed_amount != null ? q.closed_amount : q.quote_amount;
                    return (
                      <button
                        key={q.id}
                        onClick={() => onOpenVendorQuotes?.(vendorId, vendorName, category)}
                        disabled={!onOpenVendorQuotes}
                        className="flex w-full flex-wrap items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--cream)]/40 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-[var(--charcoal)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--cream)]">
                              Q{seqMap[q.id]}
                            </span>
                            <span className="font-display text-base text-[var(--charcoal)]">{amt != null ? formatINR(amt) : "—"}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CLS[q.status]}`}>
                              {QUOTE_STATUS_LABEL[q.status]}
                            </span>
                            {closed && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--terracotta-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--terracotta)]">
                                Final
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--charcoal)]/40">
                              {new Date(q.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          {q.notes && <p className="mt-1 text-xs text-[var(--charcoal)]/55">{q.notes}</p>}
                          {q.files.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {q.files.map((f) => (
                                <span
                                  key={f.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--charcoal)]/60"
                                >
                                  <FileText className="h-2.5 w-2.5" />
                                  {f.file_name}
                                  {f.size_bytes != null && ` · ${Math.round(f.size_bytes / 1024)}KB`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="text-xs text-[var(--charcoal)]/55">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-[var(--charcoal)]">{value}</div>
    </div>
  );
}
