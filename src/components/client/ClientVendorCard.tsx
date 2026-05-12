import type { ClientVendor } from "@/lib/project-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { getClientStatusOption } from "@/lib/client-status";
import { ClientStatusSelect } from "./ClientStatusSelect";
import { MapPin, Instagram, Link as LinkIcon, Paperclip, Globe, Star, FileText, CircleCheck, MessageSquare, Sparkles } from "lucide-react";
import { instagramUrl } from "@/lib/instagram";
import { formatINR, formatINRShort } from "@/lib/quote-types";
import { VendorInstagramCardStrip } from "@/components/vendor/VendorInstagramPreview";
import type { VendorInstagramPreview } from "@/server/instagram-preview.functions";

interface Props {
  vendor: ClientVendor;
  onView: () => void;
  instagramPreview?: VendorInstagramPreview | null;
}

export function ClientVendorCard({ vendor, onView, instagramPreview }: Props) {
  const colors = CATEGORY_COLORS[vendor.category] ?? {
    bg: "bg-[var(--cream-deep)]",
    text: "text-[var(--charcoal)]",
  };
  const statusOpt = getClientStatusOption(vendor.client_status);
  const isPick = !!vendor.is_saffron_pick;

  return (
    <div
      onClick={onView}
      className={`vendor-card group relative flex h-full min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white p-4 text-[var(--charcoal)] ${
        isPick ? "ring-2 ring-[var(--terracotta)] shadow-[0_0_0_4px_var(--terracotta-soft)]" : ""
      }`}
    >
      {isPick && (
        <div className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--terracotta)] to-[var(--terracotta)]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--cream)] shadow-sm">
          <Sparkles className="h-3 w-3 fill-current" /> Saffron's Pick
        </div>
      )}
      <h3 className="mb-2 font-display text-lg font-semibold leading-tight text-[var(--charcoal)]">
        {vendor.vendor_name}
      </h3>

      <div className="mb-2 flex flex-wrap gap-1">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
          {vendor.category}
        </span>
        {vendor.subcategory && (
          <span className="inline-flex items-center rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65">
            {vendor.subcategory}
          </span>
        )}
        {statusOpt && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusOpt.pill}`}>
            {statusOpt.label}
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-1.5 text-sm text-[var(--charcoal)]/75">
        {vendor.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {vendor.location}
          </div>
        )}
        {vendor.instagram_handle && (() => {
          const href = instagramUrl(vendor.instagram_handle);
          if (!href) return null;
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1.5 hover:text-[var(--terracotta)]"
            >
              <Instagram className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{href}</span>
            </a>
          );
        })()}
        {vendor.portfolio_link && (
          <a
            href={vendor.portfolio_link.startsWith("http") ? vendor.portfolio_link : `https://${vendor.portfolio_link}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-[var(--terracotta)]"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Portfolio
          </a>
        )}
        {vendor.website && (
          <a
            href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-[var(--terracotta)]"
          >
            <Globe className="h-3.5 w-3.5" /> Website
          </a>
        )}
        {vendor.google_rating != null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-[var(--terracotta)] text-[var(--terracotta)]" />
            <span>{Number(vendor.google_rating).toFixed(1)}</span>
          </div>
        )}
      </div>

      {instagramPreview && <VendorInstagramCardStrip preview={instagramPreview} />}

      <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3" style={{ marginTop: "auto" }}>
        <ClientStatusSelect vendorId={vendor.id} status={vendor.client_status} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {(() => {
              const quotes = vendor.quotes ?? [];
              if (quotes.length === 0) return null;
              const ordered = [
                ...quotes.filter((q) => q.is_final || q.status === "closed"),
                ...quotes.filter((q) => !(q.is_final || q.status === "closed")),
              ];
              return ordered.map((q) => {
                const closed = q.is_final || q.status === "closed";
                const amt = closed && q.closed_amount != null ? q.closed_amount : q.quote_amount;
                const label = amt != null ? formatINRShort(amt) : "Quote";
                const fullTitle = amt != null
                  ? `${closed ? "Closed quote" : "Quote received"} · ${formatINR(amt)}`
                  : (closed ? "Closed quote" : "Quote received");
                return (
                  <span
                    key={q.id}
                    className={
                      closed
                        ? "inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-800"
                        : "inline-flex items-center gap-1 rounded-full border border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--terracotta)]"
                    }
                    title={fullTitle}
                  >
                    {closed ? <CircleCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {label}
                  </span>
                );
              });
            })()}
            {vendor.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--charcoal)]/55">
                <Paperclip className="h-3 w-3" />
                {vendor.attachments.length} doc{vendor.attachments.length === 1 ? "" : "s"}
              </span>
            )}
            {vendor.comment_count != null && vendor.comment_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--charcoal)]/55">
                <MessageSquare className="h-3 w-3" />
                {vendor.comment_count}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="shrink-0 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
