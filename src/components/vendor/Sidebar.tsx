import { CATEGORIES, LOCATION_OPTIONS, SOURCE_OPTIONS } from "@/lib/categories";
import type { Vendor } from "@/lib/vendor-types";
import { Filter, X } from "lucide-react";

export interface FilterState {
  category: string | null;
  locations: string[];
  sources: string[];
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
    filters.category || filters.locations.length || filters.sources.length || filters.tags.length;

  return (
    <aside className="w-64 shrink-0 border-r border-white/10 bg-[oklch(0.16_0.005_60)] p-4 lg:block">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg text-[var(--gold)]">
          <Filter className="h-4 w-4" /> Filters
        </h2>
        {hasActive ? (
          <button
            onClick={() => onChange({ category: null, locations: [], sources: [], tags: [] })}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        ) : null}
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">Category</div>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={() => onChange({ ...filters, category: null })}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors ${
                !filters.category ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-white/80 hover:bg-white/5"
              }`}
            >
              <span>All Vendors</span>
              <span className="text-xs text-white/50">{vendors.length}</span>
            </button>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <button
                onClick={() => onChange({ ...filters, category: c })}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  filters.category === c ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-white/80 hover:bg-white/5"
                }`}
              >
                <span className="truncate">{c}</span>
                <span className="ml-2 shrink-0 text-xs text-white/40">{counts[c] ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Locations */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">Location</div>
        <div className="flex flex-wrap gap-1">
          {LOCATION_OPTIONS.map((loc) => {
            const active = filters.locations.includes(loc);
            return (
              <button
                key={loc}
                onClick={() => onChange({ ...filters, locations: toggle(filters.locations, loc) })}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]"
                    : "border-white/15 text-white/70 hover:border-white/30"
                }`}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </div>

      {/* Source */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">Source</div>
        <div className="flex flex-wrap gap-1">
          {SOURCE_OPTIONS.map((s) => {
            const active = filters.sources.includes(s);
            return (
              <button
                key={s}
                onClick={() => onChange({ ...filters, sources: toggle(filters.sources, s) })}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]"
                    : "border-white/15 text-white/70 hover:border-white/30"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">Tags</div>
          <div className="flex flex-wrap gap-1">
            {allTags.map((t) => {
              const active = filters.tags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t) })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    active
                      ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]"
                      : "border-white/15 text-white/70 hover:border-white/30"
                  }`}
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
