import { LOCATION_OPTIONS, useAllCategories } from "@/lib/categories";
import type { Vendor } from "@/lib/vendor-types";
import { Filter, X, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";

// Lazy-load the admin category manager — it's a heavy modal only opened on demand.
const CategoryManager = lazy(() =>
  import("./CategoryManager").then((m) => ({ default: m.CategoryManager })),
);

function LazyCategoryManager(props: { vendors: Vendor[]; onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <CategoryManager {...props} />
    </Suspense>
  );
}


export interface FilterState {
  category: string | null;
  locations: string[];
  minGoogleRating: number | null;
  minSaffronRating: number | null;
  submittedViaForm: "any" | "yes" | "no";
  hasAttachment: "any" | "yes" | "no";
  hasQuoteHistory: "any" | "yes" | "no";
  assignedToProject: "any" | "yes" | "no";
}

const RATING_OPTIONS = [3, 3.5, 4, 4.5] as const;

interface SidebarProps {
  vendors: Vendor[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  collapsed: boolean;
  onToggle: () => void;
  /** Mobile slide-over drawer state, controlled by the parent route. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  vendors,
  filters,
  onChange,
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const allCategories = useAllCategories();
  const [managerOpen, setManagerOpen] = useState(false);
  const counts = vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});

  const toggle = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const hasActive = Boolean(
    filters.category ||
    filters.locations.length ||
    filters.minGoogleRating != null ||
    filters.minSaffronRating != null ||
    filters.submittedViaForm !== "any" ||
    filters.assignedToProject !== "any" ||
    filters.hasQuoteHistory !== "any" ||
    filters.hasAttachment !== "any",
  );

  const clearAll = (): FilterState => ({
    category: null,
    locations: [],
    minGoogleRating: null,
    minSaffronRating: null,
    submittedViaForm: "any",
    hasAttachment: "any",
    hasQuoteHistory: "any",
    assignedToProject: "any",
  });

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
      active
        ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
        : "border-[var(--border)] bg-white text-[var(--charcoal)]/70 hover:border-[var(--champagne)] hover:text-[var(--charcoal)]"
    }`;

  const Body = (
    <>
      {/* Categories */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">
            Category
          </div>
          <button
            onClick={() => setManagerOpen(true)}
            title="Manage categories"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--charcoal)]/55 hover:bg-white hover:text-[var(--terracotta)]"
          >
            <Settings2 className="h-3 w-3" /> Manage
          </button>
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
              <span className="text-xs text-[var(--charcoal)]/50">{vendors.length}</span>
            </button>
          </li>
          {allCategories.map((c) => (
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

      {/* Google rating */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Google rating</div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => onChange({ ...filters, minGoogleRating: null })}
            className={chip(filters.minGoogleRating == null)}
          >
            Any
          </button>
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => onChange({ ...filters, minGoogleRating: r })}
              className={chip(filters.minGoogleRating === r)}
            >
              {r}+
            </button>
          ))}
        </div>
      </div>

      {/* Saffron rating */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Saffron rating</div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => onChange({ ...filters, minSaffronRating: null })}
            className={chip(filters.minSaffronRating == null)}
          >
            Any
          </button>
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => onChange({ ...filters, minSaffronRating: r })}
              className={chip(filters.minSaffronRating === r)}
            >
              {r}+
            </button>
          ))}
        </div>
      </div>

      {/* Source */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Source</div>
        <div className="flex flex-wrap gap-1">
          {([
            ["any", "All"],
            ["yes", "Form submissions"],
            ["no", "Manual entry"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => onChange({ ...filters, submittedViaForm: val })}
              className={chip(filters.submittedViaForm === val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Relationships */}
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/50">Relationships</div>
        {([
          ["hasAttachment", "Has Attachment"],
          ["hasQuoteHistory", "Has Quote History"],
          ["assignedToProject", "Assigned to Project"],
        ] as const).map(([key, label]) => (
          <div key={key} className="mb-2 last:mb-0">
            <div className="mb-1 text-xs text-[var(--charcoal)]/70">{label}</div>
            <div className="flex flex-wrap gap-1">
              {([
                ["any", "Any"],
                ["yes", "Yes"],
                ["no", "No"],
              ] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => onChange({ ...filters, [key]: val })}
                  className={chip(filters[key] === val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
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
                onClick={() => onChange(clearAll())}
                className="flex items-center gap-1 text-xs text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <button
              onClick={onMobileClose}
              title="Close"
              className="rounded-md p-1 text-[var(--charcoal)]/55 hover:bg-white hover:text-[var(--terracotta)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {Body}
        {managerOpen && <CategoryManager vendors={vendors} onClose={() => setManagerOpen(false)} />}
      </aside>
    </div>
  ) : null;

  if (collapsed) {
    return (
      <>
        <aside className="hidden w-12 shrink-0 border-r border-[var(--border)] bg-[var(--cream-deep)] py-4 transition-all duration-200 lg:block">
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
        {MobileOverlay}
      </>
    );
  }

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--cream-deep)] p-5 transition-all duration-200 lg:block">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--terracotta)]">
            <Filter className="h-4 w-4" /> Filters
          </h2>
          <div className="flex items-center gap-1">
            {hasActive ? (
              <button
                onClick={() => onChange(clearAll())}
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

        {Body}

        {managerOpen && <CategoryManager vendors={vendors} onClose={() => setManagerOpen(false)} />}
      </aside>
      {MobileOverlay}
    </>
  );
}
