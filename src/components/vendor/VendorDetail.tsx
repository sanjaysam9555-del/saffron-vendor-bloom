import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import {
  X, MapPin, Phone, Mail, Instagram, Globe, Star, Pencil, Trash2, Copy, Check, Link as LinkIcon, Paperclip, FileText,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatFileSize,
  getAttachmentUrl,
  listVendorAttachments,
  type VendorAttachment,
} from "@/lib/vendor-files-api";
import { DocumentViewer } from "./DocumentViewer";

interface VendorDetailProps {
  vendor: Vendor | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

export function VendorDetail({ vendor, onClose, onEdit, onDelete }: VendorDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [viewing, setViewing] = useState<VendorAttachment | null>(null);

  const { data: attachments = [] } = useQuery({
    queryKey: ["vendor-attachments", vendor?.id],
    queryFn: () => listVendorAttachments(vendor!.id),
    enabled: !!vendor?.id,
  });

  if (!vendor) return null;
  const colors = CATEGORY_COLORS[vendor.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };

  const copyContactCard = () => {
    const lines = [
      vendor.vendor_name,
      vendor.category,
      vendor.contact_number ?? "",
      vendor.instagram_handle ? `@${vendor.instagram_handle}` : "",
      vendor.website ?? "",
      vendor.price_text ?? "",
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join(" | "));
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--cream)] text-[oklch(0.18_0.01_60)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--cream)] px-6 py-4">
          <div>
            <div className="mb-1 flex flex-wrap gap-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                {vendor.category}
              </span>
              {vendor.subcategory && (
                <span className="rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65">{vendor.subcategory}</span>
              )}
            </div>
            <h2 className="font-display text-3xl leading-tight">{vendor.vendor_name}</h2>
            {vendor.google_rating != null && (
              <div className="mt-1 flex items-center gap-1 text-sm text-amber-700">
                <Star className="h-4 w-4 fill-current" /> {Number(vendor.google_rating).toFixed(1)} Google rating
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <Row icon={<MapPin />} label="Location" value={vendor.location} />
          <Row icon={<Phone />} label="Phone" value={vendor.contact_number} copy />
          <Row icon={<Mail />} label="Email" value={vendor.email} copy />
          <Row icon={<Instagram />} label="Instagram" value={vendor.instagram_handle ? `@${vendor.instagram_handle}` : null} link={vendor.instagram_handle ? `https://instagram.com/${vendor.instagram_handle}` : undefined} />
          <Row icon={<Globe />} label="Website" value={vendor.website} link={vendor.website ? (vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`) : undefined} />
          <Row icon={<LinkIcon />} label="Portfolio" value={vendor.portfolio_link} link={vendor.portfolio_link ?? undefined} />

          <Row label="Price" value={vendor.price_text} />
          <Row label="Commission" value={vendor.commission_model} />
          
          <Row label="Date Added" value={new Date(vendor.date_added).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />

          {vendor.category === "Hotels & Venues" && (
            <>
              <Row label="Rooms" value={vendor.number_of_rooms?.toString() ?? null} />
              <Row label="Distance from Delhi" value={vendor.distance_from_delhi} />
              <Row label="Hotel Category" value={vendor.hotel_category} />
            </>
          )}

          {vendor.category === "Photography & Videography" && (vendor.quote_breakdown || vendor.team_size || vendor.deliverables) && (
            <>
              <Row label="Quote Breakdown" value={vendor.quote_breakdown} className="sm:col-span-2" />
              <Row label="Team Size" value={vendor.team_size} />
              <Row label="Deliverables" value={vendor.deliverables} />
            </>
          )}

          {vendor.remarks && (
            <div className="sm:col-span-2 rounded-lg bg-[var(--cream-deep)] p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">Remarks</div>
              <div className="text-sm text-[var(--charcoal)]/80 whitespace-pre-wrap">{vendor.remarks}</div>
            </div>
          )}

        </div>

        {attachments.length > 0 && (
          <div className="border-t border-[var(--border)] px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
              <Paperclip className="h-3 w-3" /> Documents ({attachments.length})
            </div>
            <ul className="space-y-1.5">
              {attachments.map((att) => (
                <li key={att.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(att)}
                    className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-left text-sm transition-colors hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--terracotta)]" />
                      <span className="truncate text-[var(--charcoal)] group-hover:text-[var(--terracotta)]">{att.file_name}</span>
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

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--cream)] px-6 py-3">
          <button
            onClick={copyContactCard}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--terracotta)]"
          >
            {copiedCard ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copiedCard ? "Copied!" : "Copy Contact Card"}
          </button>
          <div className="flex gap-2">
            {confirmDelete ? (
              <>
                <span className="self-center text-sm text-red-700">Delete this vendor?</span>
                <button onClick={() => setConfirmDelete(false)} className="rounded-md px-3 py-2 text-sm hover:bg-[var(--cream-deep)]">Cancel</button>
                <button
                  onClick={async () => { await onDelete(); }}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-[var(--charcoal)] hover:bg-red-700"
                >
                  Confirm Delete
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
                <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, link, copy, className }: { icon?: React.ReactNode; label: string; value: string | null | undefined; link?: string; copy?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={`rounded-lg bg-[var(--cream-deep)] p-3 ${className ?? ""}`}>
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
        {icon && <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--charcoal)]/80">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="truncate hover:text-[var(--terracotta)] hover:underline">{value}</a>
        ) : (
          <span className="truncate">{value}</span>
        )}
        {copy && (
          <button onClick={handleCopy} className="shrink-0 rounded p-1 hover:bg-[var(--cream-deep)]">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 opacity-50" />}
          </button>
        )}
      </div>
    </div>
  );
}
