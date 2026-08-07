import { Filter, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function ClientSidebar({
  vendors,
  filters,
  onChange,
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
  search,
  onSearchChange,
}: Props) {
  const counts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.keys(counts).sort((a, b) => a.localeCompare(b));

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
        : "border-[var(--border)] bg-white text-[var(--charcoal)]/82 hover:border-[var(--champagne)] hover:text-[var(--charcoal)]"
    }`;

  const Body = (
    <>
      <div className="mb-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/66">
          Search
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/58" />
          <input
            data-tour="search-input"
            type="text"
            placeholder="Search your vendors…"
            aria-label="Search your vendors"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-2 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/58 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/66">
          Category
        </div>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => { onChange({ ...filters, category: null }); onMobileClose?.(); }}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                !filters.category
                  ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium"
                  : "text-[var(--charcoal)]/80 hover:bg-white"
              }`}
            >
              <span>All Vendors</span>
              <span className="text-xs text-[var(--charcoal)]/66">{vendors.length}</span>
            </button>
          </li>
          {categories.map((c) => (
            <li key={c}>
              <button
                onClick={() => { onChange({ ...filters, category: c }); onMobileClose?.(); }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  filters.category === c
                    ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium"
                    : "text-[var(--charcoal)]/80 hover:bg-white"
                }`}
              >
                <span className="truncate">{c}</span>
                <span className="ml-2 shrink-0 text-xs text-[var(--charcoal)]/62">{counts[c] ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {locations.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/66">
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
    </>
  );

  const MobileOverlay = mobileOpen ? (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onMobileClose} aria-label="Close filters" />
      <aside className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col overflow-y-auto bg-[var(--cream-deep)] p-5 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--terracotta)]">
            <Filter className="h-4 w-4" /> Filters
          </h2>
          <div className="flex items-center gap-2">
            {hasActive && (
              <button
                onClick={() => onChange({ category: null, locations: [] })}
                className="flex items-center gap-1 text-xs text-[var(--charcoal)]/74 hover:text-[var(--terracotta)]"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <button
              onClick={onMobileClose}
              title="Close"
              aria-label="Close filters"
              className="rounded-md p-1 text-[var(--charcoal)]/70 hover:bg-white hover:text-[var(--terracotta)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {Body}
      </aside>
    </div>
  ) : null;

  if (collapsed) {
    return (
      <>
        <aside data-tour="filters-panel" className="hidden w-12 shrink-0 self-stretch border-r border-[var(--border)] bg-[var(--cream-deep)] py-4 transition-all duration-200 lg:block">
          <button
            data-tour="filters-button"
            onClick={onToggle}
            title="Expand filters"
            aria-label="Expand filters"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-[var(--terracotta)] hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mt-2 flex justify-center">
            <div className="rounded-md p-2 text-[var(--charcoal)]/74" title="Filters">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          {hasActive && (
            <div className="mt-1 flex justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--terracotta)]" title="Filters active" />
            </div>
          )}
        </aside>
        {MobileOverlay}
      </>
    );
  }

  return (
    <>
      <aside data-tour="filters-panel" className="hidden w-64 shrink-0 self-stretch border-r border-[var(--border)] bg-[var(--cream-deep)] p-5 transition-all duration-200 lg:block">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--terracotta)]">
            <Filter className="h-4 w-4" /> Filters
          </h2>
          <div className="flex items-center gap-1">
            {hasActive ? (
              <button
                onClick={() => onChange({ category: null, locations: [] })}
                className="flex items-center gap-1 text-xs text-[var(--charcoal)]/74 hover:text-[var(--terracotta)]"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            ) : null}
            <button
              onClick={onToggle}
              title="Collapse filters"
              aria-label="Collapse filters"
              className="ml-1 rounded-md p-1 text-[var(--charcoal)]/70 hover:bg-white hover:text-[var(--terracotta)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
        {Body}
      </aside>
      {MobileOverlay}
    </>
  );
}
