import { Instagram, MapPin, MessageSquare, Phone, Plus, Star, Trash2 } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/categories";
import { instagramUrl, instagramDisplay } from "@/lib/instagram";
import { VendorMediaBand } from "@/components/vendor/VendorMediaBand";
import { ClientStatusPill } from "@/components/admin/ClientStatusPill";
import type { VendorInstagramPreview } from "@/lib/instagram-preview.functions";

type Selection = { user_id: string; display_name: string; email: string; status: string; updated_at: string };

/**
 * Every field sits in a fixed-height slot, same discipline as the vendor
 * directory card (VendorCard.tsx) — a vendor missing a price or a second
 * client response leaves blank space instead of shifting everything below it.
 */
const SLOT = {
  media: "h-24",
  name: "h-[2.6rem]",
  category: "h-4",
  price: "h-[1.15rem]",
  status: "h-6",
  quotes: "h-6",
} as const;

export function AssignedVendorCard({
  vendor,
  selectionRows,
  primarySelection,
  instagramPreview,
  onOpenDetail,
  onRemove,
  onOpenComments,
  onAddQuote,
  quotesPill,
  saffronToggle,
}: {
  vendor: {
    id: string;
    vendor_name: string;
    category: string | null;
    subcategory?: string | null;
    price_text?: string | null;
    location?: string | null;
    google_rating?: number | null;
    instagram_handle?: string | null;
    contact_number?: string | null;
    comment_count?: number | null;
  };
  selectionRows: Selection[];
  primarySelection: Selection | null;
  instagramPreview?: VendorInstagramPreview | null;
  onOpenDetail: () => void;
  onRemove: () => void;
  onOpenComments: () => void;
  onAddQuote: () => void;
  /** <VendorQuotesPill/> — stays a caller-owned component since it carries its own query. */
  quotesPill: React.ReactNode;
  /** <SaffronPickToggle/> — same reason. */
  saffronToggle: React.ReactNode;
}) {
  const colors = CATEGORY_COLORS[vendor.category ?? ""] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };
  const igHref = vendor.instagram_handle ? instagramUrl(vendor.instagram_handle) : null;
  const igDisplay = vendor.instagram_handle ? instagramDisplay(vendor.instagram_handle) : null;
  const digits = vendor.contact_number?.replace(/\D/g, "") ?? "";
  const intl = digits.length === 10 ? `91${digits}` : digits;
  const telHref = digits ? `tel:+${intl}` : null;

  const commentCount = vendor.comment_count ?? 0;
  const otherResponses = selectionRows.length > 1 ? selectionRows.length - 1 : 0;

  return (
    <div className="group relative flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm transition hover:border-[var(--terracotta)]/40 hover:shadow-md">
      <button
        onClick={onRemove}
        title="Remove from project"
        aria-label={`Remove ${vendor.vendor_name} from project`}
        className="absolute right-2 top-2 z-20 rounded-md bg-white/90 p-1.5 text-[var(--charcoal)]/50 opacity-0 shadow-sm transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)] group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <VendorMediaBand
        vendorId={vendor.id}
        instagramHandle={vendor.instagram_handle}
        preview={instagramPreview}
        heightClass={SLOT.media}
      />

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-2.5">
        {/* ── Name + rating ── */}
        <div className={`flex ${SLOT.name} items-start justify-between gap-2`}>
          <button
            type="button"
            onClick={onOpenDetail}
            className="line-clamp-2 min-w-0 text-left font-display text-[15px] font-semibold leading-[1.3] text-[var(--charcoal)] hover:text-[var(--terracotta)]"
            title={vendor.vendor_name}
          >
            {vendor.vendor_name}
          </button>
          {vendor.google_rating != null && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--gold-soft)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[hsl(38_45%_28%)]"
              title="Google rating"
            >
              <Star className="h-2.5 w-2.5 fill-current" />
              {Number(vendor.google_rating).toFixed(1)}
            </span>
          )}
        </div>

        {/* ── Category ── */}
        <div className={`flex ${SLOT.category} items-center gap-1.5`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.bg}`} />
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--charcoal)]/55">
            {vendor.category}
          </span>
          {vendor.subcategory && (
            <span className="truncate text-[10px] text-[var(--charcoal)]/35">· {vendor.subcategory}</span>
          )}
          {vendor.location && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 truncate text-[10px] text-[var(--charcoal)]/40">
              <MapPin className="h-2.5 w-2.5" />
              {vendor.location}
            </span>
          )}
        </div>

        {/* ── Price ── */}
        <div className={`flex ${SLOT.price} items-center`}>
          {vendor.price_text && (
            <span className="truncate text-[13px] font-semibold text-[var(--terracotta)]" title={vendor.price_text}>
              {vendor.price_text}
            </span>
          )}
        </div>

        {/* ── Client status — the reason this card exists in a project ── */}
        <div className={`mt-1.5 flex ${SLOT.status} items-center gap-1.5 border-t border-[var(--border)] pt-2`}>
          <ClientStatusPill status={primarySelection?.status ?? null} size="xs" />
          {otherResponses > 0 && (
            <span
              className="text-[10px] text-[var(--charcoal)]/40"
              title={selectionRows.map((r) => `${r.display_name || r.email}: ${r.status}`).join("\n")}
            >
              +{otherResponses} more
            </span>
          )}
        </div>

        {/* ── Quotes — blank when there are none, never collapses to 0 height
               so a quoted vendor's card doesn't grow taller than its
               neighbours. ── */}
        <div className={`mt-1 flex ${SLOT.quotes} items-center overflow-hidden`}>{quotesPill}</div>

        {/* ── Footer ── */}
        <div className="mt-auto pt-2.5">
          <div className="flex items-center gap-1.5 border-t border-[var(--border)] pt-2.5">
            {saffronToggle}
            <button
              onClick={onOpenComments}
              title="View client comments"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--charcoal)]/65 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              <MessageSquare className="h-3 w-3" />
              {commentCount > 0 ? commentCount : ""}
            </button>

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

          <button
            onClick={onAddQuote}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--terracotta)]/40 px-3 py-1.5 text-xs font-medium text-[var(--terracotta)] transition hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
            title="Add a new quote for this vendor"
          >
            <Plus className="h-3 w-3" /> Add quote
          </button>
        </div>
      </div>
    </div>
  );
}
