import { CATEGORIES, LOCATION_OPTIONS } from "@/lib/categories";
import type { Vendor } from "@/lib/vendor-types";
import { Filter, X } from "lucide-react";

export interface FilterState {
  category: string | null;
  locations: string[];
  tags: string[];
}

interface SidebarProps {
  vendors: Vendor[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

export function Sidebar({ vendors, filters, onChange }: SidebarProps) {
  const counts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});

  const allTags = Array.from(
    new Set(vendors.flatMap((v) => v.tags ?? []).filter(Boolean)),
  ).sort();

  const toggle = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const hasActive =
    filters.category || filters.locations.length || filters.tags.length;

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
      active
        ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
        : "border-[var(--border)] bg-white text-[var(--charcoal)]/70 hover:border-[var(--champagne)] hover:text-[var(--charcoal)]"
    }`;

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--cream-deep)] p-5 lg:block">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--terracotta)]">
          <Filter className="h-4 w-4" /> Filters
        </h2>
        {hasActive ? (
          <button
            onClick={() => onChange({ category: null, locations: [], tags: [] })}
            className="flex items-center gap-1 text-xs text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        ) : null}
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Category</div>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => onChange({ ...filters, category: null })}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                !filters.category
                  ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium"
                  : "text-[var(--charcoal)]/80 hover:bg-white"
              }`}
            >
              <span>All Vendors</span>
              <span className="text-xs text-[var(--charcoal)]/50">{vendors.length}</span>
            </button>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <button
                onClick={() => onChange({ ...filters, category: c })}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  filters.category === c
                    ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium"
                    : "text-[var(--charcoal)]/80 hover:bg-white"
                }`}
              >
                <span className="truncate">{c}</span>
                <span className="ml-2 shrink-0 text-xs text-[var(--charcoal)]/45">{counts[c] ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Locations */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Location</div>
        <div className="flex flex-wrap gap-1">
          {LOCATION_OPTIONS.map((loc) => {
            const active = filters.locations.includes(loc);
            return (
              <button
                key={loc}
                onClick={() => onChange({ ...filters, locations: toggle(filters.locations, loc) })}
                className={chip(active)}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Tags</div>
          <div className="flex flex-wrap gap-1">
            {allTags.map((t) => {
              const active = filters.tags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t) })}
                  className={chip(active)}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
