import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { MapPin, Phone, Star, Sparkles, Instagram, Copy, Check, MessageCircle, IndianRupee } from "lucide-react";
import { useState } from "react";
import { VendorProjectAssigner } from "./VendorProjectAssigner";
import { BookedBadge } from "./BookedBadge";
import { instagramUrl, instagramDisplay } from "@/lib/instagram";
import { VendorMediaBand } from "./VendorMediaBand";
import type { VendorInstagramPreview } from "@/lib/instagram-preview.functions";

interface VendorCardProps {
  vendor: Vendor;
  onView: () => void;
  onEdit: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  instagramPreview?: VendorInstagramPreview | null;
  bookedSummary?: import("@/lib/quote-types").VendorBookedSummary | null;
}

/**
 * Every field sits in a fixed-height slot so the same information lands on the
 * same line across every card in the grid. A vendor missing a location leaves
 * blank space rather than pulling the rows beneath it upward — scanning a
 * column of cards should never require re-finding where a field lives.
 */
const SLOT = {
  media: "h-28",
  name: "h-[2.6rem]",
  category: "h-4",
  location: "h-4",
  price: "h-[1.15rem]",
  contact: "h-7",
  assigner: "h-6",
} as const;

export function VendorCard({
  vendor,
  onView,
  onEdit,
  selectMode = false,
  selected = false,
  onToggleSelect,
  instagramPreview,
  bookedSummary,
}: VendorCardProps) {
  const [copied, setCopied] = useState(false);
  const colors = CATEGORY_COLORS[vendor.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };

  // Contact targets. The Instagram link is an icon button — the card used to
  // print the full profile URL, which never fit and always truncated.
  const igHref = vendor.instagram_handle ? instagramUrl(vendor.instagram_handle) : null;
  const igDisplay = vendor.instagram_handle ? instagramDisplay(vendor.instagram_handle) : null;
  const digits = vendor.contact_number?.replace(/\D/g, "") ?? "";
  const intl = digits.length === 10 ? `91${digits}` : digits;
  const telHref = digits ? `tel:+${intl}` : null;
  const waHref = digits ? `https://wa.me/${intl}` : null;

  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!vendor.contact_number) return;
    navigator.clipboard.writeText(vendor.contact_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCardClick = () => {
    if (selectMode) onToggleSelect?.();
    else onView();
  };

  return (
    <div
      onClick={handleCardClick}
      className={`vendor-card group relative flex h-full min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-xl bg-white text-[var(--charcoal)] ${
        selectMode && selected ? "ring-2 ring-[var(--terracotta)] ring-offset-2 ring-offset-[var(--cream)]" : ""
      }`}
    >
      {selectMode && (
        <div className="absolute left-2 top-2 z-20 rounded bg-white/90 p-1 shadow-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--terracotta)]"
            aria-label={`Select ${vendor.vendor_name}`}
          />
        </div>
      )}

      {/* ── Media band, full bleed ── */}
      <VendorMediaBand
        vendorId={vendor.id}
        instagramHandle={vendor.instagram_handle}
        preview={instagramPreview}
        heightClass={SLOT.media}
        overlay={<BookedBadge vendorId={vendor.id} compact summary={bookedSummary} />}
      />

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-2.5">
        {/* ── Name + ratings ── */}
        <div className={`flex ${SLOT.name} items-start justify-between gap-2`}>
          <h3
            className="line-clamp-2 min-w-0 font-display text-[15px] font-semibold leading-[1.3] text-[var(--charcoal)]"
            title={vendor.vendor_name}
          >
            {vendor.vendor_name}
          </h3>
          {(vendor.google_rating != null || vendor.saffron_rating != null) && (
            <div className="flex shrink-0 items-center gap-1">
              {vendor.google_rating != null && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-[var(--gold-soft)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[hsl(38_45%_28%)]"
                  title="Google rating"
                >
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {Number(vendor.google_rating).toFixed(1)}
                </span>
              )}
              {vendor.saffron_rating != null && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-[var(--terracotta-soft)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--terracotta)]"
                  title="Saffron team rating"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {Number(vendor.saffron_rating).toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Category — a colour dot instead of a filled chip keeps the
               category readable without competing with the name ── */}
        <div className={`flex ${SLOT.category} items-center gap-1.5`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.bg}`} />
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--charcoal)]/55">
            {vendor.category}
          </span>
          {vendor.subcategory && (
            <span className="truncate text-[10px] text-[var(--charcoal)]/35">
              · {vendor.subcategory}
            </span>
          )}
          {vendor.submitted_via_form && (
            <span
              className="ml-auto shrink-0 text-[10px] text-[var(--terracotta)]/60"
              title="Vendor self-registered via the public signup form"
            >
              ✦
            </span>
          )}
        </div>

        {/* ── Location ── */}
        <div className={`mt-1.5 flex ${SLOT.location} items-center gap-1.5 text-xs text-[var(--charcoal)]/60`}>
          {vendor.location && (
            <>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{vendor.location}</span>
            </>
          )}
        </div>

        {/* ── Price — same treatment as location so the two read as one
               field group rather than one shouting over the other ── */}
        <div className={`mt-1.5 flex ${SLOT.price} items-center gap-1.5 text-xs text-[var(--charcoal)]/60`}>
          {vendor.price_text && (
            <>
              <IndianRupee className="h-3 w-3 shrink-0" />
              <span className="truncate" title={vendor.price_text}>
                {vendor.price_text}
              </span>
            </>
          )}
        </div>


        {/* ── Footer ── */}
        <div className="mt-auto pt-3">
          <div className={`flex ${SLOT.contact} items-center gap-1.5 border-t border-[var(--border)] pt-2.5`}>
            {vendor.contact_number ? (
              <button
                onClick={copyPhone}
                title="Click to copy"
                className="inline-flex min-w-0 items-center gap-1 text-xs text-[var(--charcoal)]/70 hover:text-[var(--terracotta)]"
              >
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{vendor.contact_number}</span>
                {copied ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 shrink-0 opacity-30" />
                )}
              </button>
            ) : (
              <span className="text-xs text-[var(--charcoal)]/30">No number</span>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {igHref && (
                <a
                  href={igHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Instagram — ${vendor.vendor_name}`}
                  title={igDisplay ?? "Instagram"}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--charcoal)]/45 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                >
                  <Instagram className="h-3 w-3" />
                </a>
              )}
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`WhatsApp ${vendor.vendor_name}`}
                  title="WhatsApp"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[#25D366] transition hover:border-[#25D366] hover:bg-[#25D366]/10"
                >
                  <MessageCircle className="h-3 w-3" />
                </a>
              )}
              {telHref && (
                <a
                  href={telHref}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Call ${vendor.vendor_name}`}
                  title="Call"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--terracotta)] transition hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                >
                  <Phone className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Clipped to one row: a vendor on several projects would otherwise
              wrap and push the buttons out of alignment with its neighbours. */}
          <div className={`mt-2 ${SLOT.assigner} overflow-hidden`}>
            <VendorProjectAssigner vendorId={vendor.id} compact />
          </div>

          <div className="mt-2 flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onView(); }}
              className="flex-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
            >
              View Details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/70 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

