import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import {
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  Sparkles,
  Instagram,
  Phone,
  MessageCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { instagramUrl, instagramDisplay } from "@/lib/instagram";
import { getVendorBookedSummary } from "@/lib/quote-api";
import { BookedBadge } from "./BookedBadge";

type SortKey =
  | "vendor_name"
  | "category"
  | "location"
  | "price_text"
  | "google_rating"
  | "saffron_rating"
  | "date_added";
type SortDir = "asc" | "desc";

interface VendorTableProps {
  vendors: Vendor[];
  onView: (v: Vendor) => void;
  onEdit: (v: Vendor) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export function VendorTable({
  vendors,
  onView,
  onEdit,
  selectMode = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: VendorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date_added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...vendors];
    copy.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [vendors, sortKey, sortDir]);

  // Incremental render — only mount the first N rows, then more as the user
  // scrolls. Avoids painting 400+ rows on first load.
  const BATCH = 80;
  const [visibleCount, setVisibleCount] = useState(BATCH);
  useEffect(() => {
    setVisibleCount(BATCH);
  }, [vendors]);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (visibleCount >= sorted.length) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + BATCH, sorted.length));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visibleCount, sorted.length]);
  const visibleRows = sorted.slice(0, visibleCount);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  // One bulk lookup for every row's booked count. BookedBadge falls back to a
  // per-vendor query when `summary` is omitted, which would be one request per
  // row; the key matches the card grid's so both views share the cache.
  const allIds = useMemo(() => vendors.map((v) => v.id), [vendors]);
  const idsKey = useMemo(() => allIds.slice().sort().join(","), [allIds]);
  const { data: bookedMap } = useQuery({
    queryKey: ["vendor-booked-summary-bulk", idsKey],
    queryFn: () => getVendorBookedSummary(allIds),
    enabled: allIds.length > 0,
    staleTime: 60_000,
  });

  /**
   * Sortable header. The old version showed the same neutral glyph on every
   * column, so the table never revealed which column it was actually sorted by
   * — the active column now shows its direction, the rest reveal a hint on
   * hover.
   */
  const Th = ({
    k,
    label,
    align = "left",
    className,
  }: {
    k: SortKey;
    label: string;
    align?: "left" | "right";
    className?: string;
  }) => {
    const active = sortKey === k;
    return (
      <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}>
        <button
          onClick={() => toggleSort(k)}
          className={`group/th inline-flex items-center gap-1 transition-colors hover:text-[var(--cream)] ${
            active ? "text-[var(--cream)]" : ""
          }`}
          title={`Sort by ${label.toLowerCase()}`}
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3 text-[var(--terracotta)]" />
            ) : (
              <ArrowDown className="h-3 w-3 text-[var(--terracotta)]" />
            )
          ) : (
            // Always visible, just quiet: hiding this until hover left no cue
            // that the column was sortable at all.
            <ArrowUpDown className="h-3 w-3 opacity-40 transition-opacity group-hover/th:opacity-90" />
          )}
        </button>
      </th>
    );
  };

  const allVisibleSelected =
    selectMode && vendors.length > 0 && vendors.every((v) => selectedIds?.has(v.id));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
            <tr>
              {selectMode && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => onToggleSelectAll?.()}
                    className="h-4 w-4 rounded border-white/20 accent-[var(--terracotta)]"
                    aria-label="Select all visible"
                  />
                </th>
              )}
              <Th k="vendor_name" label="Vendor" />
              <Th k="category" label="Category" />
              <Th k="location" label="Location" />
              <Th k="price_text" label="Price" />
              <Th k="google_rating" label="Rating" />
              <th className="px-4 py-2.5">Contact</th>
              <Th k="date_added" label="Added" align="right" />
              <th className="w-12 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="[&_tr:nth-child(even)]:bg-[var(--cream)]/25">
            {visibleRows.map((v) => {
              const colors = CATEGORY_COLORS[v.category] ?? {
                bg: "bg-[var(--cream-deep)]",
                text: "text-[var(--charcoal)]",
              };
              const isSelected = !!selectedIds?.has(v.id);
              const igHref = v.instagram_handle ? instagramUrl(v.instagram_handle) : null;
              const igLabel = v.instagram_handle ? instagramDisplay(v.instagram_handle) : null;
              const digits = v.contact_number?.replace(/\D/g, "") ?? "";
              const intl = digits.length === 10 ? `91${digits}` : digits;

              return (
                <tr
                  key={v.id}
                  onClick={() => selectMode && onToggleSelect?.(v.id)}
                  className={`border-t border-[var(--border)] transition-colors ${
                    selectMode ? "cursor-pointer" : ""
                  } ${isSelected ? "!bg-[var(--terracotta-soft)]" : "hover:!bg-[var(--cream)]/60"}`}
                >
                  {selectMode && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(v.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--terracotta)]"
                        aria-label={`Select ${v.vendor_name}`}
                      />
                    </td>
                  )}

                  {/* Vendor — name carries the handle beneath it so the
                      identity reads as one unit rather than two columns. */}
                  <td className="max-w-[280px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      {selectMode ? (
                        <span className="truncate font-medium text-[var(--charcoal)]">{v.vendor_name}</span>
                      ) : (
                        <button
                          onClick={() => onView(v)}
                          className="truncate text-left font-medium text-[var(--charcoal)] hover:text-[var(--terracotta)]"
                          title={v.vendor_name}
                        >
                          {v.vendor_name}
                        </button>
                      )}
                      <BookedBadge vendorId={v.id} compact summary={bookedMap?.[v.id] ?? null} />
                      {v.submitted_via_form && (
                        <span
                          className="shrink-0 text-[10px] text-[var(--terracotta)]/60"
                          title="Self-registered via the public signup form"
                        >
                          ✦
                        </span>
                      )}
                    </div>
                    {igLabel && (
                      <div className="mt-0.5 truncate text-[11px] text-[var(--charcoal)]/62">{igLabel}</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
                    >
                      {v.category}
                    </span>
                    {v.subcategory && (
                      <div className="mt-0.5 truncate text-[11px] text-[var(--charcoal)]/58">{v.subcategory}</div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-[var(--charcoal)]/82">{v.location || "—"}</td>

                  <td className="max-w-[200px] px-4 py-3">
                    {v.price_text ? (
                      <span className="block truncate font-medium text-[var(--terracotta)]" title={v.price_text}>
                        {v.price_text}
                      </span>
                    ) : (
                      <span className="text-[var(--charcoal)]/52">—</span>
                    )}
                  </td>

                  {/* Both ratings together — the old table showed only Google,
                      hiding the Saffron score the cards lead with. */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {v.google_rating != null && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-[var(--gold-soft)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[hsl(38_45%_28%)]"
                          title="Google rating"
                        >
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {Number(v.google_rating).toFixed(1)}
                        </span>
                      )}
                      {v.saffron_rating != null && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-[var(--terracotta-soft)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--terracotta)]"
                          title="Saffron team rating"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {Number(v.saffron_rating).toFixed(1)}
                        </span>
                      )}
                      {v.google_rating == null && v.saffron_rating == null && (
                        <span className="text-[var(--charcoal)]/52">—</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {digits || igHref ? (
                      <div className="flex items-center gap-1">
                        {digits && (
                          <>
                            <a
                              href={`tel:+${intl}`}
                              onClick={(e) => e.stopPropagation()}
                              title={v.contact_number ?? "Call"}
                              aria-label={`Call ${v.vendor_name}`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--terracotta)] transition hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                            >
                              <Phone className="h-3 w-3" />
                            </a>
                            <a
                              href={`https://wa.me/${intl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="WhatsApp"
                              aria-label={`WhatsApp ${v.vendor_name}`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[#25D366] transition hover:border-[#25D366] hover:bg-[#25D366]/10"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          </>
                        )}
                        {igHref && (
                          <a
                            href={igHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={igLabel ?? "Instagram"}
                            aria-label={`Instagram — ${v.vendor_name}`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--charcoal)]/78 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                          >
                            <Instagram className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--charcoal)]/52">—</span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-[11px] text-[var(--charcoal)]/62">
                    {new Date(v.date_added).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {!selectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(v);
                        }}
                        className="rounded p-1 text-[var(--charcoal)]/78 transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {visibleCount < sorted.length && (
              <tr ref={sentinelRef} aria-hidden>
                <td colSpan={selectMode ? 9 : 8} className="h-10" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
