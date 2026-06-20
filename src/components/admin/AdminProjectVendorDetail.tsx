import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, ChevronLeft, ChevronRight, MapPin, Phone, Mail, Instagram, Globe, Star, Sparkles, Trash2, Plus,
  Link as LinkIcon, MessageSquare, FileText, CircleCheck, Paperclip,
} from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/categories";
import { ClientStatusPill } from "@/components/admin/ClientStatusPill";
import { instagramDisplay, instagramUrl } from "@/lib/instagram";
import { VendorInstagramDetailBlock } from "@/components/vendor/VendorInstagramPreview";
import { VendorCommentsThread } from "@/components/client/VendorCommentsThread";
import { AttachmentThumbnailGrid } from "@/components/vendor/AttachmentThumbnailGrid";
import { SignedDocumentViewer } from "@/components/vendor/SignedDocumentViewer";
import { AttachmentGalleryViewer } from "@/components/vendor/AttachmentGalleryViewer";
import { listVendorAttachments, type VendorAttachment } from "@/lib/vendor-files-api";
import { listProjectVendorQuotes } from "@/lib/quote-api";
import { formatINR, formatINRShort, ordinal, buildQuoteSeqMap } from "@/lib/quote-types";

export interface ProjectVendorSelection {
  status: string;
  display_name: string | null;
  email: string | null;
}

interface Props {
  projectId: string;
  vendor: any | null;
  vendors?: any[];
  selections?: ProjectVendorSelection[];
  onClose: () => void;
  onNavigate?: (vendor: any) => void;
  onOpenQuotes: (autoOpenForm: boolean) => void;
  onRemove: () => void;
}

export function AdminProjectVendorDetail({
  projectId,
  vendor,
  vendors,
  selections = [],
  onClose,
  onNavigate,
  onOpenQuotes,
  onRemove,
}: Props) {
  const [viewing, setViewing] = useState<VendorAttachment | null>(null);

  const navIndex = vendor && vendors ? vendors.findIndex((v) => v.id === vendor.id) : -1;
  const prevVendor = navIndex > 0 ? vendors![navIndex - 1] : null;
  const nextVendor = navIndex >= 0 && vendors && navIndex < vendors.length - 1 ? vendors[navIndex + 1] : null;
  const canNavigate = !!onNavigate && !!vendors && navIndex >= 0;

  useEffect(() => {
    setViewing(null);
  }, [vendor?.id]);

  useEffect(() => {
    if (!canNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      if (e.key === "ArrowLeft" && prevVendor) {
        e.preventDefault();
        onNavigate!(prevVendor);
      } else if (e.key === "ArrowRight" && nextVendor) {
        e.preventDefault();
        onNavigate!(nextVendor);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNavigate, prevVendor, nextVendor, onNavigate]);

  const { data: quotes = [] } = useQuery({
    queryKey: ["project-vendor-quotes", projectId, vendor?.id],
    queryFn: () => listProjectVendorQuotes(projectId, vendor!.id),
    enabled: !!vendor?.id,
    staleTime: 30_000,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["vendor-attachments", vendor?.id],
    queryFn: () => listVendorAttachments(vendor!.id),
    enabled: !!vendor?.id,
  });

  if (!vendor) return null;
  const colors = CATEGORY_COLORS[vendor.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };

  const seqMap = buildQuoteSeqMap(quotes);
  const orderedQuotes = [
    ...quotes.filter((q) => q.is_final || q.status === "closed"),
    ...quotes.filter((q) => !(q.is_final || q.status === "closed")),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {canNavigate && prevVendor && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate!(prevVendor); }}
          aria-label="Previous vendor"
          className="absolute left-2 top-1/2 z-[51] -translate-y-1/2 rounded-full bg-white/90 p-2 text-[var(--charcoal)] shadow-lg hover:bg-white sm:left-6"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canNavigate && nextVendor && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate!(nextVendor); }}
          aria-label="Next vendor"
          className="absolute right-2 top-1/2 z-[51] -translate-y-1/2 rounded-full bg-white/90 p-2 text-[var(--charcoal)] shadow-lg hover:bg-white sm:right-6"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--cream)] text-[var(--charcoal)] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--cream)] px-6 py-4">
          <div className="min-w-0">
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
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--terracotta)]/40 bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--terracotta)]">
                Project view
              </span>
            </div>
            <h2 className="font-display text-2xl leading-tight sm:text-3xl">{vendor.vendor_name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canNavigate && (
              <span className="rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] font-medium text-[var(--charcoal)]/65">
                {navIndex + 1} / {vendors!.length}
              </span>
            )}
            <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Client status rows */}
        <div className="border-b border-[var(--border)] bg-[var(--cream-deep)]/30 px-6 py-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
            Client status on this project
          </div>
          {selections.length === 0 ? (
            <div className="text-xs text-[var(--charcoal)]/55">No client has responded yet.</div>
          ) : (
            <ul className="space-y-1.5">
              {selections.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-[var(--charcoal)]/80">{s.display_name || s.email || "Client"}</span>
                  <ClientStatusPill status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quotes summary */}
        <div className="border-b border-[var(--border)] px-6 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
              Quotes ({orderedQuotes.length})
            </div>
            <button
              onClick={() => onOpenQuotes(orderedQuotes.length === 0)}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-2.5 py-1 text-[11px] font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
            >
              <Plus className="h-3 w-3" /> {orderedQuotes.length === 0 ? "Add quote" : "Manage quotes"}
            </button>
          </div>
          {orderedQuotes.length === 0 ? (
            <div className="text-xs text-[var(--charcoal)]/55">No quotes yet for this vendor on this project.</div>
          ) : (
            <ul className="space-y-1.5">
              {orderedQuotes.map((q) => {
                const closed = q.is_final || q.status === "closed";
                const amt = closed && q.closed_amount != null ? q.closed_amount : q.quote_amount;
                const seqLabel = closed ? "Closed Quote" : `${ordinal(seqMap[q.id])} Quote`;
                return (
                  <li
                    key={q.id}
                    className={
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs " +
                      (closed
                        ? "border-green-200 bg-green-50/60 text-green-900"
                        : "border-[var(--border)] bg-white text-[var(--charcoal)]/80")
                    }
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      {closed ? <CircleCheck className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="truncate">{seqLabel}</span>
                      <span className="text-[10px] text-[var(--charcoal)]/55">
                        {new Date(q.created_at).toLocaleDateString("en-IN")}
                      </span>
                    </span>
                    {amt != null && (
                      <span className="shrink-0 font-semibold" title={formatINR(amt)}>
                        {formatINRShort(amt)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Core vendor facts */}
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <Row icon={<MapPin />} label="Location" value={vendor.location} />
          <Row icon={<Phone />} label="Phone" value={vendor.contact_number} />
          <Row icon={<Mail />} label="Email" value={vendor.email} />
          <Row
            icon={<Instagram />}
            label="Instagram"
            value={instagramDisplay(vendor.instagram_handle)}
            link={instagramUrl(vendor.instagram_handle) ?? undefined}
          />
          <Row
            icon={<Globe />}
            label="Website"
            value={vendor.website}
            link={vendor.website ? (vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`) : undefined}
          />
          <Row
            icon={<LinkIcon />}
            label="Portfolio"
            value={vendor.portfolio_link}
            link={vendor.portfolio_link ? (vendor.portfolio_link.startsWith("http") ? vendor.portfolio_link : `https://${vendor.portfolio_link}`) : undefined}
          />
          <Row label="Price" value={vendor.price_text} />
          <Row label="Commission" value={vendor.commission_model} />
          {vendor.google_rating != null && (
            <Row icon={<Star />} label="Google Rating" value={`${Number(vendor.google_rating).toFixed(1)} ★`} />
          )}
          {vendor.saffron_rating != null && (
            <Row icon={<Sparkles />} label="Saffron Rating" value={`${Number(vendor.saffron_rating).toFixed(1)} ★`} />
          )}
          {vendor.remarks && (
            <div className="sm:col-span-2 rounded-lg bg-[var(--cream-deep)] p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">Remarks</div>
              <div className="whitespace-pre-wrap text-sm text-[var(--charcoal)]/80">{vendor.remarks}</div>
            </div>
          )}
        </div>

        {/* Instagram preview */}
        <VendorInstagramDetailBlock vendorId={vendor.id} handle={vendor.instagram_handle} canRefresh />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="border-t border-[var(--border)] px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
              <Paperclip className="h-3 w-3" /> Documents ({attachments.length})
            </div>
            <AttachmentThumbnailGrid attachments={attachments} onOpen={setViewing} />
          </div>
        )}

        {/* Comments */}
        <div className="border-t border-[var(--border)] px-6 py-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
            <MessageSquare className="h-3 w-3" /> Client comments
          </div>
          <VendorCommentsThread projectId={projectId} vendorId={vendor.id} asStaff adminCanDelete />
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--cream)] px-6 py-3">
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Remove from project
          </button>
        </div>
      </div>

      {viewing && (
        (viewing.mime_type ?? "").toLowerCase().startsWith("image/") ||
        /\.(jpe?g|png|webp|gif|avif|svg|bmp)$/i.test(viewing.file_name)
      ) ? (
        <AttachmentGalleryViewer
          attachments={attachments}
          initialId={viewing!.id}
          onClose={() => setViewing(null)}
        />
      ) : viewing ? (
        <SignedDocumentViewer
          filePath={viewing.file_path}
          fileName={viewing.file_name}
          mimeType={viewing.mime_type}
          onClose={() => setViewing(null)}
        />
      ) : null}
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
    <div className="rounded-lg bg-[var(--cream-deep)] p-3 min-w-0">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
        {icon && <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
        {label}
      </div>
      <div className="min-w-0 text-sm text-[var(--charcoal)]/80">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="block truncate hover:text-[var(--terracotta)] hover:underline">
            {value}
          </a>
        ) : (
          <span className="block truncate">{value}</span>
        )}
      </div>
    </div>
  );
}
