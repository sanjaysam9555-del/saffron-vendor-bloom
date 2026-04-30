import { Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ClientVendor } from "@/lib/project-types";

export interface ClientFilterState {
  category: string | null;
  locations: string[];
}

interface Props {
  vendors: ClientVendor[];
  filters: ClientFilterState;
  onChange: (f: ClientFilterState) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function ClientSidebar({ vendors, filters, onChange, collapsed, onToggle }: Props) {
  const counts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.keys(counts).sort();

  const locationSet = new Set<string>();
  for (const v of vendors) {
    if (v.location && v.location.trim()) locationSet.add(v.location.trim());
  }
  const locations = Array.from(locationSet).sort();

  const toggle = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const hasActive = Boolean(filters.category || filters.locations.length);

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
      active
        ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
        : "border-[var(--border)] bg-white text-[var(--charcoal)]/70 hover:border-[var(--champagne)] hover:text-[var(--charcoal)]"
    }`;

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-[var(--border)] bg-[var(--cream-deep)] py-4 transition-all duration-200">
        <button
          onClick={onToggle}
          title="Expand filters"
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-[var(--terracotta)] hover:bg-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-2 flex justify-center">
          <div className="rounded-md p-2 text-[var(--charcoal)]/60" title="Filters">
            <Filter className="h-4 w-4" />
          </div>
        </div>
        {hasActive && (
          <div className="mt-1 flex justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--terracotta)]" title="Filters active" />
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--cream-deep)] p-5 transition-all duration-200 lg:block">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--terracotta)]">
          <Filter className="h-4 w-4" /> Filters
        </h2>
        <div className="flex items-center gap-1">
          {hasActive ? (
            <button
              onClick={() => onChange({ category: null, locations: [] })}
              className="flex items-center gap-1 text-xs text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          ) : null}
          <button
            onClick={onToggle}
            title="Collapse filters"
            className="ml-1 rounded-md p-1 text-[var(--charcoal)]/55 hover:bg-white hover:text-[var(--terracotta)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">
          Category
        </div>
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
          {categories.map((c) => (
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

      {locations.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">
            Location
          </div>
          <div className="flex flex-wrap gap-1">
            {locations.map((loc) => {
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
      )}
    </aside>
  );
}
