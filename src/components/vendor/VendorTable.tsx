import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS, formatPriceRange } from "@/lib/categories";
import { Pencil, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

type SortKey = "vendor_name" | "category" | "location" | "price_range_low" | "price_range_high" | "google_rating" | "date_added";
type SortDir = "asc" | "desc";

export function VendorTable({
  vendors,
  onView,
  onEdit,
}: {
  vendors: Vendor[];
  onView: (v: Vendor) => void;
  onEdit: (v: Vendor) => void;
}) {
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

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--charcoal)]/55 ${className ?? ""}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-[var(--terracotta)]">
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--cream-deep)]">
          <tr>
            <Th k="vendor_name" label="Name" />
            <Th k="category" label="Category" />
            <Th k="location" label="Location" />
            <Th k="price_range_low" label="Price Low" />
            <Th k="price_range_high" label="Price High" />
            <Th k="google_rating" label="Rating" />
            <Th k="date_added" label="Date Added" />
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => {
            const colors = CATEGORY_COLORS[v.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };
            return (
              <tr key={v.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--cream)]">
                <td className="px-3 py-2.5">
                  <button onClick={() => onView(v)} className="text-left font-medium text-[var(--charcoal)] hover:text-[var(--terracotta)]">
                    {v.vendor_name}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                    {v.category}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.location ?? "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.price_range_low != null ? formatPriceRange(v.price_range_low) : "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.price_range_high != null ? formatPriceRange(v.price_range_high) : "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.google_rating != null ? Number(v.google_rating).toFixed(1) : "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/55">{new Date(v.date_added).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => onEdit(v)} className="rounded p-1 text-[var(--charcoal)]/55 hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
