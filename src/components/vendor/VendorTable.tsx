import type { Vendor } from "@/lib/vendor-types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { Pencil, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";


type SortKey = "vendor_name" | "category" | "location" | "price_text" | "google_rating" | "date_added";
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

  const allVisibleSelected =
    selectMode && vendors.length > 0 && vendors.every((v) => selectedIds?.has(v.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--cream-deep)]">
          <tr>
            {selectMode && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => onToggleSelectAll?.()}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--terracotta)]"
                  aria-label="Select all visible"
                />
              </th>
            )}
            <Th k="vendor_name" label="Name" />
            <Th k="category" label="Category" />
            <Th k="location" label="Location" />
            <Th k="price_text" label="Price" />
            <Th k="google_rating" label="Rating" />
            <Th k="date_added" label="Date Added" />
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => {
            const colors = CATEGORY_COLORS[v.category] ?? { bg: "bg-[var(--cream-deep)]", text: "text-[var(--charcoal)]" };
            const isSelected = !!selectedIds?.has(v.id);
            const handleRowClick = () => {
              if (selectMode) onToggleSelect?.(v.id);
            };
            return (
              <tr
                key={v.id}
                onClick={handleRowClick}
                className={`border-b border-[var(--border)] last:border-b-0 ${
                  selectMode ? "cursor-pointer" : ""
                } ${isSelected ? "bg-[var(--terracotta-soft)]" : "hover:bg-[var(--cream)]"}`}
              >
                {selectMode && (
                  <td className="w-10 px-3 py-2.5">
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
                <td className="px-3 py-2.5">
                  {selectMode ? (
                    <span className="font-medium text-[var(--charcoal)]">{v.vendor_name}</span>
                  ) : (
                    <button onClick={() => onView(v)} className="text-left font-medium text-[var(--charcoal)] hover:text-[var(--terracotta)]">
                      {v.vendor_name}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                    {v.category}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.location ?? "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.price_text ?? "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/75">{v.google_rating != null ? Number(v.google_rating).toFixed(1) : "—"}</td>
                <td className="px-3 py-2.5 text-[var(--charcoal)]/55">{new Date(v.date_added).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                <td className="px-3 py-2.5 text-right">
                  {!selectMode && (
                    <button onClick={(e) => { e.stopPropagation(); onEdit(v); }} className="rounded p-1 text-[var(--charcoal)]/55 hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
