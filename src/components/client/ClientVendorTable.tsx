import type { ClientVendor } from "@/lib/project-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { getClientStatusOption } from "@/lib/client-status";
import { ClientStatusSelect } from "./ClientStatusSelect";
import { CircleCheck, FileText, Star, Paperclip, MessageSquare, Sparkles } from "lucide-react";
import { formatINR, formatINRShort, ordinal, buildQuoteSeqMap } from "@/lib/quote-types";
import { useEffect, useRef, useState } from "react";

interface Props {
  vendors: ClientVendor[];
  onView: (vendor: ClientVendor) => void;
}

export function ClientVendorTable({ vendors, onView }: Props) {
  // Incremental render — only mount the first N rows, then more on scroll.
  const BATCH = 80;
  const [visibleCount, setVisibleCount] = useState(BATCH);
  useEffect(() => {
    setVisibleCount(BATCH);
  }, [vendors]);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (visibleCount >= vendors.length) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + BATCH, vendors.length));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visibleCount, vendors.length]);
  const visibleRows = vendors.slice(0, visibleCount);

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white animate-fade-in">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-[var(--cream-deep)]/60 text-[10px] uppercase tracking-widest text-[var(--charcoal)]/55">
          <tr>
            <Th>Vendor</Th>
            <Th>Category</Th>
            <Th>Location</Th>
            <Th>Status</Th>
            <Th>Quotes</Th>
            <Th>Rating</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((v) => {
            const colors = CATEGORY_COLORS[v.category] ?? {
              bg: "bg-[var(--cream-deep)]",
              text: "text-[var(--charcoal)]",
            };
            const statusOpt = getClientStatusOption(v.client_status);
            const quotes = v.quotes ?? [];
            const seqMap = buildQuoteSeqMap(quotes);
            const ordered = [
              ...quotes.filter((q) => q.is_final || q.status === "closed"),
              ...quotes.filter((q) => !(q.is_final || q.status === "closed")),
            ];
            return (
              <tr
                key={v.id}
                className="border-t border-[var(--border)] hover:bg-[var(--cream-deep)]/30"
              >
                <Td>
                  <button
                    onClick={() => onView(v)}
                    className="inline-flex items-center gap-1.5 text-left font-medium text-[var(--charcoal)] hover:text-[var(--terracotta)]"
                  >
                    {v.is_saffron_pick && (
                      <span title="Saffron's Pick" className="inline-flex items-center gap-0.5 rounded-full bg-[var(--terracotta)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--cream)]">
                        <Sparkles className="h-2.5 w-2.5 fill-current" /> Pick
                      </span>
                    )}
                    {v.vendor_name}
                  </button>
                  {(v.attachments.length > 0 || (v.comment_count ?? 0) > 0) && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--charcoal)]/55">
                      {v.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Paperclip className="h-3 w-3" /> {v.attachments.length}
                        </span>
                      )}
                      {(v.comment_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" /> {v.comment_count}
                        </span>
                      )}
                    </div>
                  )}
                </Td>
                <Td>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
                  >
                    {v.category}
                  </span>
                  {v.subcategory && (
                    <div className="mt-0.5 text-[10px] text-[var(--charcoal)]/55">
                      {v.subcategory}
                    </div>
                  )}
                </Td>
                <Td className="text-[var(--charcoal)]/75">{v.location ?? "—"}</Td>
                <Td>
                  <div className="min-w-[140px]">
                    <ClientStatusSelect vendorId={v.id} status={statusOpt?.value ?? null} />
                  </div>
                </Td>
                <Td>
                  {ordered.length === 0 ? (
                    <span className="text-[10px] text-[var(--charcoal)]/45">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {ordered.map((q) => {
                        const closed = q.is_final || q.status === "closed";
                        const amt = closed && q.closed_amount != null ? q.closed_amount : q.quote_amount;
                        const seqLabel = closed ? "Closed Quote" : `${ordinal(seqMap[q.id])} Quote`;
                        const amtLabel = amt != null ? formatINRShort(amt) : null;
                        const tip = amt != null
                          ? `${seqLabel} · ${formatINR(amt)}`
                          : seqLabel;
                        return (
                          <span
                            key={q.id}
                            title={tip}
                            className={
                              closed
                                ? "inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-800"
                                : "inline-flex items-center gap-1 rounded-full border border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--terracotta)]"
                            }
                          >
                            {closed ? <CircleCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            <span>{seqLabel}{amtLabel ? ` · ${amtLabel}` : ""}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Td>
                <Td>
                  {v.google_rating != null ? (
                    <span className="inline-flex items-center gap-1 text-[var(--charcoal)]/80">
                      <Star className="h-3.5 w-3.5 fill-[var(--terracotta)] text-[var(--terracotta)]" />
                      {Number(v.google_rating).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--charcoal)]/45">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  <button
                    onClick={() => onView(v)}
                    className="rounded-md bg-[var(--terracotta)] px-3 py-1 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
                  >
                    View
                  </button>
                </Td>
              </tr>
            );
          })}
          {visibleCount < vendors.length && (
            <tr ref={sentinelRef} aria-hidden>
              <td colSpan={7} className="h-10" />
            </tr>
          )}
        </tbody>
      </table>

    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`align-top px-3 py-2 ${className}`}>{children}</td>;
}
