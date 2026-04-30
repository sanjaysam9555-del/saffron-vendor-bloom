import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { MapPin, Phone, Star, Instagram, Copy, Check } from "lucide-react";
import { useState } from "react";
import { VendorProjectAssigner } from "./VendorProjectAssigner";

interface VendorCardProps {
  vendor: Vendor;
  onView: () => void;
  onEdit: () => void;
}

export function VendorCard({ vendor, onView, onEdit }: VendorCardProps) {
  const [copied, setCopied] = useState(false);
  const colors = CATEGORY_COLORS[vendor.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };

  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!vendor.contact_number) return;
    navigator.clipboard.writeText(vendor.contact_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={onView}
      className="vendor-card group flex h-full cursor-pointer flex-col rounded-lg bg-white p-4 text-[var(--charcoal)]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold leading-tight text-[var(--charcoal)]">{vendor.vendor_name}</h3>
        {vendor.google_rating != null && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-[hsl(42_65%_55%/0.18)] px-2 py-0.5 text-xs font-medium text-[hsl(42_65%_30%)]">
            <Star className="h-3 w-3 fill-current" />
            {Number(vendor.google_rating).toFixed(1)}
          </div>
        )}
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
      </div>

      <div className="space-y-1.5 text-sm text-[var(--charcoal)]/75">
        {vendor.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {vendor.location}
          </div>
        )}
        {vendor.contact_number && (
          <button
            onClick={copyPhone}
            className="flex items-center gap-1.5 hover:text-[var(--terracotta)]"
            title="Click to copy"
          >
            <Phone className="h-3.5 w-3.5" /> {vendor.contact_number}
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 opacity-40" />}
          </button>
        )}
        {vendor.instagram_handle && (() => {
          const raw = vendor.instagram_handle.trim();
          const handle = raw
            .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
            .replace(/^@/, "")
            .replace(/\/.*$/, "")
            .replace(/\?.*$/, "");
          const href = /^https?:\/\//i.test(raw) ? raw : `https://instagram.com/${handle}`;
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1.5 hover:text-[var(--terracotta)]"
            >
              <Instagram className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">@{handle}</span>
            </a>
          );
        })()}
        {vendor.price_text && (
          <div className="text-sm font-medium text-[var(--terracotta)]">
            {vendor.price_text}
          </div>
        )}
      </div>

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
    </div>
  );
}
