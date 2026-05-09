import { useState } from "react";
import type { ClientVendor } from "@/lib/project-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { X, MapPin, Instagram, Link as LinkIcon, Paperclip, FileText, Globe, Star, CircleCheck, Sparkles } from "lucide-react";
import { SignedDocumentViewer } from "@/components/vendor/SignedDocumentViewer";
import { SignedQuoteFileViewer } from "@/components/admin/SignedQuoteFileViewer";
import { formatFileSize } from "@/lib/vendor-files-api";
import { ClientStatusSelect } from "./ClientStatusSelect";
import { useQuery } from "@tanstack/react-query";
import { listProjectVendorQuotes } from "@/lib/quote-api";
import { formatINR, type QuoteFile, type ProjectVendorQuote } from "@/lib/quote-types";
import { VendorCommentsThread } from "./VendorCommentsThread";

interface Props {
  vendor: ClientVendor | null;
  onClose: () => void;
}

export function ClientVendorDetail({ vendor, onClose }: Props) {
  const [viewing, setViewing] = useState<ClientVendor["attachments"][number] | null>(null);
  const [viewingQuoteFile, setViewingQuoteFile] = useState<QuoteFile | null>(null);

  // Subscribe to the my-project cache so the status stays in sync with the card.
  const { data: project } = useQuery<{ project: { id: string }; vendors: ClientVendor[] }>({
    queryKey: ["my-project"],
    enabled: false,
  });
  const liveVendor = project?.vendors.find((v) => v.id === vendor?.id);
  const liveStatus = liveVendor?.client_status ?? vendor?.client_status ?? null;
  const projectId = project?.project?.id;

  const { data: quotes = [] } = useQuery({
    queryKey: ["client-vendor-quotes", projectId, vendor?.id],
    queryFn: () => listProjectVendorQuotes(projectId!, vendor!.id),
    enabled: !!projectId && !!vendor?.id,
  });

  if (!vendor) return null;
  const colors = CATEGORY_COLORS[vendor.category] ?? {
    bg: "bg-[var(--cream-deep)]",
    text: "text-[var(--charcoal)]",
  };

  // Closed/final quotes first, then others newest-first (already newest-first from API).
  const orderedQuotes: ProjectVendorQuote[] = [
    ...quotes.filter((q) => q.is_final || q.status === "closed"),
    ...quotes.filter((q) => !(q.is_final || q.status === "closed")),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--cream)] text-[oklch(0.18_0.01_60)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--cream)] px-6 py-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                {vendor.category}
              </span>
              {vendor.subcategory && (
                <span className="rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65">
                  {vendor.subcategory}
                </span>
              )}
              {vendor.is_saffron_pick && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--terracotta)] to-[var(--terracotta)]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--cream)] shadow-sm">
                  <Sparkles className="h-3 w-3 fill-current" /> Saffron's Pick
                </span>
              )}
            </div>
            <h2 className="font-display text-3xl leading-tight">{vendor.vendor_name}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[var(--border)] bg-[var(--cream-deep)]/40 px-6 py-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
            Your status
          </div>
          <ClientStatusSelect vendorId={vendor.id} status={liveStatus} />
        </div>

        {orderedQuotes.length > 0 && (
          <div className="border-b border-[var(--border)] bg-white px-6 py-3 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
              Quotes ({orderedQuotes.length})
            </div>
            {orderedQuotes.map((quote) => {
              const isClosed = quote.status === "closed" || quote.is_final;
              const amt = isClosed && quote.closed_amount != null ? quote.closed_amount : quote.quote_amount;
              return (
                <div
                  key={quote.id}
                  className={`rounded-md border p-3 ${isClosed ? "border-green-200 bg-green-50/40" : "border-[var(--border)] bg-[var(--cream)]/40"}`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
                    {isClosed ? (
                      <><CircleCheck className="h-3 w-3 text-green-700" /> <span className="text-green-800">Your quote (closed)</span></>
                    ) : (
                      <>Quote · {new Date(quote.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</>
                    )}
                  </div>
                  {amt != null && (
                    <div className={`text-lg font-semibold ${isClosed ? "text-green-900" : "text-[var(--charcoal)]"}`}>
                      {formatINR(amt)}
                    </div>
                  )}
                  {quote.quote_text && (
                    <div className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--cream-deep)]/60 p-2 text-sm text-[var(--charcoal)]/85">
                      {quote.quote_text}
                    </div>
                  )}
                  {quote.files && quote.files.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {quote.files.map((f: QuoteFile) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => setViewingQuoteFile(f)}
                            className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--cream)]/60 px-2.5 py-1.5 text-left text-xs hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                              <span className="truncate text-[var(--charcoal)] group-hover:text-[var(--terracotta)]">{f.file_name}</span>
                            </div>
                            <span className="shrink-0 text-[10px] text-[var(--charcoal)]/55">{formatFileSize(f.size_bytes)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <Row icon={<MapPin />} label="Location" value={vendor.location} />
          <Row
            icon={<Instagram />}
            label="Instagram"
            value={vendor.instagram_handle ? `@${vendor.instagram_handle}` : null}
            link={vendor.instagram_handle ? `https://instagram.com/${vendor.instagram_handle}` : undefined}
          />
          <Row
            icon={<LinkIcon />}
            label="Portfolio"
            value={vendor.portfolio_link}
            link={
              vendor.portfolio_link
                ? vendor.portfolio_link.startsWith("http")
                  ? vendor.portfolio_link
                  : `https://${vendor.portfolio_link}`
                : undefined
            }
          />
          <Row
            icon={<Globe />}
            label="Website"
            value={vendor.website}
            link={
              vendor.website
                ? vendor.website.startsWith("http")
                  ? vendor.website
                  : `https://${vendor.website}`
                : undefined
            }
          />
          <Row
            icon={<Star />}
            label="Google Rating"
            value={vendor.google_rating != null ? `${Number(vendor.google_rating).toFixed(1)} ★` : null}
          />
        </div>

        {vendor.attachments.length > 0 && (
          <div className="border-t border-[var(--border)] px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
              <Paperclip className="h-3 w-3" /> Documents ({vendor.attachments.length})
            </div>
            <ul className="space-y-1.5">
              {vendor.attachments.map((att) => (
                <li key={att.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(att)}
                    className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-left text-sm transition-colors hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--terracotta)]" />
                      <span className="truncate text-[var(--charcoal)] group-hover:text-[var(--terracotta)]">
                        {att.file_name}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--charcoal)]/55">
                      {formatFileSize(att.size_bytes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {projectId && (
          <div className="border-t border-[var(--border)] px-6 py-4">
            <VendorCommentsThread projectId={projectId} vendorId={vendor.id} />
          </div>
        )}
      </div>

      {viewing && (
        <SignedDocumentViewer
          filePath={viewing.file_path}
          fileName={viewing.file_name}
          mimeType={viewing.mime_type}
          onClose={() => setViewing(null)}
        />
      )}

      {viewingQuoteFile && (
        <SignedQuoteFileViewer
          filePath={viewingQuoteFile.file_path}
          fileName={viewingQuoteFile.file_name}
          mimeType={viewingQuoteFile.mime_type}
          onClose={() => setViewingQuoteFile(null)}
        />
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  link,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | null | undefined;
  link?: string;
}) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-[var(--cream-deep)] p-3">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
        {icon && <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--charcoal)]/80">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="truncate hover:text-[var(--terracotta)] hover:underline">
            {value}
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )}
      </div>
    </div>
  );
}
