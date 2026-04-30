import type { ClientVendor } from "@/lib/project-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { getClientStatusOption } from "@/lib/client-status";
import { ClientStatusSelect } from "./ClientStatusSelect";
import { MapPin, Instagram, Link as LinkIcon, Paperclip, Globe, Star } from "lucide-react";

interface Props {
  vendor: ClientVendor;
  onView: () => void;
}

export function ClientVendorCard({ vendor, onView }: Props) {
  const colors = CATEGORY_COLORS[vendor.category] ?? {
    bg: "bg-[var(--cream-deep)]",
    text: "text-[var(--charcoal)]",
  };

  return (
    <div
      onClick={onView}
      className="vendor-card group flex h-full cursor-pointer flex-col rounded-lg bg-white p-4 text-[var(--charcoal)]"
    >
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
      </div>

      <div className="space-y-1.5 text-sm text-[var(--charcoal)]/75">
        {vendor.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {vendor.location}
          </div>
        )}
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
        {vendor.price_text && (
          <div className="text-sm font-medium text-[var(--terracotta)]">{vendor.price_text}</div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3" style={{ marginTop: "auto" }}>
        <div className="flex items-center gap-1.5 text-xs text-[var(--charcoal)]/60">
          <Paperclip className="h-3.5 w-3.5" />
          {vendor.attachments.length === 0
            ? "No documents"
            : `${vendor.attachments.length} document${vendor.attachments.length === 1 ? "" : "s"}`}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
