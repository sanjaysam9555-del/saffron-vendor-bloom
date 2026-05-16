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
      <h3 className="mb-2 line-clamp-1 min-h-[1.75rem] font-display text-lg font-semibold leading-tight text-[var(--charcoal)]">
        {vendor.vendor_name}
      </h3>

      <div className="mb-2 flex min-h-[1.5rem] flex-wrap gap-1">
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
          {vendor.category}
        </span>
        {vendor.subcategory && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65">
            {vendor.subcategory}
          </span>
        )}
        {statusOpt && (
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusOpt.pill}`}>
            {statusOpt.label}
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-1.5 text-sm text-[var(--charcoal)]/75">
        {(() => {
          const igHref = vendor.instagram_handle ? instagramUrl(vendor.instagram_handle) : null;
          const portfolioHref = vendor.portfolio_link
            ? (vendor.portfolio_link.startsWith("http") ? vendor.portfolio_link : `https://${vendor.portfolio_link}`)
            : null;
          const websiteHref = vendor.website
            ? (vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`)
            : null;
          const spacer = <div aria-hidden className="h-[1.125rem]" />;
          return (
            <>
              {vendor.location ? (
                <div className="flex h-[1.125rem] items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{vendor.location}</span>
                </div>
              ) : spacer}
              {igHref ? (
                <a
                  href={igHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-[1.125rem] min-w-0 items-center gap-1.5 hover:text-[var(--terracotta)]"
                >
                  <Instagram className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{igHref}</span>
                </a>
              ) : spacer}
              {portfolioHref ? (
                <a
                  href={portfolioHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-[1.125rem] items-center gap-1.5 hover:text-[var(--terracotta)]"
                >
                  <LinkIcon className="h-3.5 w-3.5 shrink-0" /> Portfolio
                </a>
              ) : spacer}
              {websiteHref ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-[1.125rem] items-center gap-1.5 hover:text-[var(--terracotta)]"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" /> Website
                </a>
              ) : spacer}
              {vendor.google_rating != null ? (
                <div className="flex h-[1.125rem] items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-[var(--terracotta)] text-[var(--terracotta)]" />
                  <span>{Number(vendor.google_rating).toFixed(1)}</span>
                </div>
              ) : spacer}
            </>
          );
        })()}
      </div>

      {vendor.instagram_handle ? (
        <VendorInstagramCardStrip preview={instagramPreview} hasHandle />
      ) : (
        <div className="mt-2 flex min-h-[148px] items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-2 text-[10px] text-[var(--charcoal)]/40">
          No Instagram linked
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-[var(--border)] pt-3">
        <ClientStatusSelect vendorId={vendor.id} status={vendor.client_status} />
        <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
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
