import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Paperclip, CircleCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listVendorQuoteHistory } from "@/lib/quote-api";
import { formatINR, QUOTE_STATUS_LABEL, type QuoteFile } from "@/lib/quote-types";
import { SignedQuoteFileViewer } from "@/components/admin/SignedQuoteFileViewer";
import { supabase } from "@/integrations/supabase/client";

export function VendorQuoteHistory({ vendorId }: { vendorId: string }) {
  const [viewing, setViewing] = useState<QuoteFile | null>(null);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["vendor-quote-history", vendorId],
    queryFn: () => listVendorQuoteHistory(vendorId),
  });

  const projectIds = Array.from(new Set(quotes.map((q) => q.project_id)));
  const { data: projects = [] } = useQuery({
    queryKey: ["vendor-quote-history-projects", projectIds.sort().join(",")],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, bride_name, groom_name, wedding_date")
        .in("id", projectIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: projectIds.length > 0,
  });

  const projectMap = Object.fromEntries(projects.map((p: any) => [p.id, p]));

  return (
    <div className="border-t border-[var(--border)] px-6 py-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
        <FileText className="h-3 w-3" /> Quote history
        {quotes.length > 0 && (
          <span className="rounded-full bg-[var(--cream-deep)] px-1.5 text-[10px] text-[var(--charcoal)]/65">
            {quotes.length}
          </span>
        )}
      </div>

      <div className="mt-3">
          {isLoading ? (
            <div className="text-xs text-[var(--charcoal)]/55">Loading…</div>
          ) : quotes.length === 0 ? (
            <div className="text-xs text-[var(--charcoal)]/55">
              No quotes recorded for this vendor yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {quotes.map((q) => {
                const proj = projectMap[q.project_id];
                const amt =
                  q.status === "closed" && q.closed_amount != null
                    ? q.closed_amount
                    : q.quote_amount;
                return (
                  <li
                    key={q.id}
                    className="rounded-md border border-[var(--border)] bg-white p-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        {proj ? (
                          <Link
                            to="/admin/projects/$id"
                            params={{ id: q.project_id }}
                            className="font-medium text-[var(--charcoal)] hover:text-[var(--terracotta)]"
                          >
                            {proj.bride_name} & {proj.groom_name}
                          </Link>
                        ) : (
                          <span className="font-medium text-[var(--charcoal)]/60">Project</span>
                        )}
                        <span className="ml-1 text-[10px] text-[var(--charcoal)]/55">
                          {new Date(q.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {q.status === "closed" || q.is_final ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">
                            <CircleCheck className="h-2.5 w-2.5" /> Closed
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--cream-deep)] px-1.5 py-0.5 text-[10px] text-[var(--charcoal)]/70">
                            {QUOTE_STATUS_LABEL[q.status]}
                          </span>
                        )}
                        {amt != null && (
                          <span className="font-semibold text-[var(--charcoal)]">
                            {formatINR(amt)}
                          </span>
                        )}
                        {(q as any).files?.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--charcoal)]/55">
                            <Paperclip className="h-2.5 w-2.5" /> {(q as any).files.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {(q as any).files?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {(q as any).files.map((f: QuoteFile) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => setViewing(f)}
                              className="inline-flex items-center gap-1 text-[10px] text-[var(--charcoal)]/65 hover:text-[var(--terracotta)]"
                            >
                              <FileText className="h-2.5 w-2.5" />
                              <span className="truncate">{f.file_name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {viewing && (
        <SignedQuoteFileViewer
          filePath={viewing.file_path}
          fileName={viewing.file_name}
          mimeType={viewing.mime_type}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
