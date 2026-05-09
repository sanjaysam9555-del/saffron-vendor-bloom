import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { MapPin, Phone, Star, Sparkles, Instagram, Copy, Check, MessageCircle } from "lucide-react";
import { useState } from "react";
import { VendorProjectAssigner } from "./VendorProjectAssigner";
import { BookedBadge } from "./BookedBadge";
import { instagramUrl } from "@/lib/instagram";

interface VendorCardProps {
  vendor: Vendor;
  onView: () => void;
  onEdit: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function VendorCard({
  vendor,
  onView,
  onEdit,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: VendorCardProps) {
  const [copied, setCopied] = useState(false);
  const colors = CATEGORY_COLORS[vendor.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };

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
      className={`vendor-card group relative flex h-full min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white p-4 text-[var(--charcoal)] ${
        selectMode && selected ? "ring-2 ring-[var(--terracotta)] ring-offset-2 ring-offset-[var(--cream)]" : ""
      }`}
    >
      {selectMode && (
        <div className="absolute left-2 top-2 z-10">
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
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className={`font-display text-lg font-semibold leading-tight text-[var(--charcoal)] ${selectMode ? "pl-6" : ""}`}>{vendor.vendor_name}</h3>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {vendor.google_rating != null && (
            <div
              className="flex items-center gap-0.5 rounded-full bg-[hsl(42_65%_55%/0.18)] px-2 py-0.5 text-xs font-medium text-[hsl(42_65%_30%)]"
              title="Google rating"
            >
              <Star className="h-3 w-3 fill-current" />
              {Number(vendor.google_rating).toFixed(1)}
            </div>
          )}
          {vendor.saffron_rating != null && (
            <div
              className="flex items-center gap-0.5 rounded-full border border-[var(--terracotta)]/40 bg-[var(--terracotta-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--terracotta)]"
              title="Saffron Team rating"
            >
              <Sparkles className="h-3 w-3" />
              <span className="tracking-wide">S {Number(vendor.saffron_rating).toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
          {vendor.category}
        </span>
        {vendor.subcategory && (
          <span className="inline-flex items-center rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65">
            {vendor.subcategory}
          </span>
        )}
        {vendor.submitted_via_form && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full border border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--terracotta)]"
            title="Vendor self-registered via the public signup form"
          >
            ✦ Via Form
          </span>
        )}
        <BookedBadge vendorId={vendor.id} compact />
      </div>

      <div className="min-w-0 space-y-1.5 text-sm text-[var(--charcoal)]/75">
        {vendor.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {vendor.location}
          </div>
        )}
        {vendor.contact_number && (() => {
          const digits = vendor.contact_number.replace(/\D/g, "");
          // Default to +91 (India) when no country code is present.
          const intl = digits.length === 10 ? `91${digits}` : digits;
          const telHref = `tel:+${intl}`;
          const waHref = `https://wa.me/${intl}`;
          return (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <button
                onClick={copyPhone}
                className="min-w-0 truncate text-left hover:text-[var(--terracotta)]"
                title="Click to copy"
              >
                {vendor.contact_number}
              </button>
              {copied ? (
                <Check className="h-3 w-3 shrink-0 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 shrink-0 opacity-40" />
              )}
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`WhatsApp ${vendor.vendor_name}`}
                title="WhatsApp"
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
              <a
                href={telHref}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Call ${vendor.vendor_name}`}
                title="Call"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--terracotta)] hover:bg-[var(--terracotta-soft)] hover:border-[var(--terracotta)]"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })()}
        {vendor.instagram_handle && (() => {
          const raw = vendor.instagram_handle.trim().replace(/^@+/, "");
          const handle = raw
            .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
            .replace(/\/.*$/, "")
            .replace(/\?.*$/, "");
          const href = `https://www.instagram.com/${handle}/`;
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
        {vendor.price_text && (
          <div className="text-sm font-medium text-[var(--terracotta)]">
            {vendor.price_text}
          </div>
        )}
      </div>

      {!selectMode && (
        <>
          <div className="mt-3 border-t border-[var(--border)] pt-3" style={{ marginTop: 'auto' }}>
            <VendorProjectAssigner vendorId={vendor.id} compact />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onView(); }}
              className="flex-1 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
            >
              View Details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
