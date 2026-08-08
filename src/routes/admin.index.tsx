import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useFocusTarget } from "@/lib/deep-link";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Table as TableIcon, Sparkles, CheckSquare, Filter as FilterIcon, ArrowUpDown, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getVendorBookedSummary } from "@/lib/quote-api";

import { TopNav } from "@/components/vendor/TopNav";
import { Sidebar, type FilterState } from "@/components/vendor/Sidebar";
import { VendorCard } from "@/components/vendor/VendorCard";
import { VendorTable } from "@/components/vendor/VendorTable";
import { BulkActionBar } from "@/components/vendor/BulkActionBar";
import { VirtualGrid } from "@/components/ui/VirtualGrid";
import { useVendors, useVendorMutations, useVendorModals } from "@/hooks/useVendorData";
import { useAllCategories } from "@/lib/categories";

import { useIsAdmin } from "@/lib/auth";
import { useAutoEnsureMissingPreviews, useInstagramPreviewsBulk } from "@/hooks/use-instagram-previews";
import { useVendorTabState, type VendorSortKey } from "@/components/admin/admin-tab-state";
import { useSetMobilePageTitle } from "@/lib/mobile-page-title";
import { SkeletonBlock } from "@/components/ui/LoadingState";


// Lazy-load heavy dialogs and the detail drawer so they don't bloat the
// initial admin bundle. They only render when the user opens them.
const VendorForm = lazy(() =>
  import("@/components/vendor/VendorForm").then((m) => ({ default: m.VendorForm })),
);
const VendorDetail = lazy(() =>
  import("@/components/vendor/VendorDetail").then((m) => ({ default: m.VendorDetail })),
);
const BulkEditDialog = lazy(() =>
  import("@/components/vendor/BulkEditDialog").then((m) => ({ default: m.BulkEditDialog })),
);



type SortKey = VendorSortKey;

const SORT_LABEL: Record<SortKey, string> = {
  date_added_desc: "Newest added",
  date_added_asc: "Oldest added",
  updated_desc: "Last modified",
  name_asc: "Name A→Z",
  name_desc: "Name Z→A",
};
const DEFAULT_SORT: SortKey = "date_added_desc";

/** Vendors rendered per page, replacing the previous unbounded scroll. */
const VENDORS_PER_PAGE = 100;

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Vendor Dashboard — Saffron Planning Studio" },
      { name: "description", content: "Saffron Planning Studio staff dashboard for managing wedding vendors." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // The vendors UI is rendered by the /admin layout (see VendorsPane export
  // below) only when the Vendors tab is active. Persistent UI state lives in
  // AdminTabStateProvider so the view returns as the user left it.
  component: () => null,
});

export function VendorsPane() {
  return <DashboardPage />;
}

/**
 * Tracks whether the main admin sidebar is collapsed.
 *
 * AdminSidebar publishes its width on `--sidebar-w` (the layout already uses it
 * for content offset), so we observe that rather than lifting the state into a
 * context just for the vendor grid.
 */
function useMainSidebarCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--sidebar-w")
        .trim();
      setCollapsed(parseInt(raw || "200", 10) < 100);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, []);
  return collapsed;
}

function DashboardPage() {

  const isAdmin = useIsAdmin();
  const categories = useAllCategories();
  const { data: vendors = [], isLoading } = useVendors();
  const instagramVendorIds = useMemo(
    () => vendors.filter((v) => v.instagram_handle).map((v) => v.id),
    [vendors],
  );
  const { map: instagramPreviewMap, isLoading: instagramPreviewsLoading } =
    useInstagramPreviewsBulk(instagramVendorIds);
  const { create, update, remove, bulkUpdate, bulkDelete } = useVendorMutations();
  const modals = useVendorModals();

  // Persisted tab state (survives tab switches via AdminTabStateProvider).
  const {
    search,
    setSearch,
    view,
    setView,
    filters,
    setFilters,
    sort,
    setSort,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useVendorTabState();

  // Both rails only compete for space from `lg` up; below that they overlay.
  const mainSidebarCollapsed = useMainSidebarCollapsed();
  const bothRailsOpen = !sidebarCollapsed && !mainSidebarCollapsed;

  // Local-only state (resets on tab switch by design).
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useSetMobilePageTitle(filters.category ?? "All Vendors");

  // ── Deep linking ────────────────────────────────────────────────────────
  // Universal search sends `/admin?v=<vendorId>` (and optionally `focus`).
  // Open that vendor's detail sheet as soon as the vendor list is available,
  // highlight its card/row, and drop the params when the sheet is closed.
  const deepLink = useSearch({ strict: false }) as { v?: string; focus?: string };
  const navigate = useNavigate();
  const openedDeepLinkRef = useRef<string | null>(null);
  useFocusTarget(deepLink.focus ?? deepLink.v, !isLoading);

  useEffect(() => {
    const id = deepLink.v;
    if (!id || openedDeepLinkRef.current === id) return;
    const target = vendors.find((v) => v.id === id);
    if (!target) return;
    openedDeepLinkRef.current = id;
    modals.openDetail(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink.v, vendors]);

  const clearDeepLink = useCallback(() => {
    openedDeepLinkRef.current = null;
    if (!deepLink.v && !deepLink.focus) return;
    navigate({ to: "/admin", search: {} as never, replace: true });
  }, [deepLink.v, deepLink.focus, navigate]);




  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = vendors.filter((v) => {
      if (filters.category && v.category !== filters.category) return false;
      if (filters.locations.length && !filters.locations.some((l) => v.location?.toLowerCase().includes(l.toLowerCase()))) return false;
      if (filters.minGoogleRating != null && (v.google_rating ?? -1) < filters.minGoogleRating) return false;
      if (filters.minSaffronRating != null && (v.saffron_rating ?? -1) < filters.minSaffronRating) return false;
      if (filters.submittedViaForm === "yes" && !v.submitted_via_form) return false;
      if (filters.submittedViaForm === "no" && v.submitted_via_form) return false;
      if (filters.assignedToProject === "yes" && !v.has_assignment) return false;
      if (filters.assignedToProject === "no" && v.has_assignment) return false;
      if (filters.hasQuoteHistory === "yes" && !v.has_quote_history) return false;
      if (filters.hasQuoteHistory === "no" && v.has_quote_history) return false;
      if (filters.hasAttachment === "yes" && !v.has_attachment) return false;
      if (filters.hasAttachment === "no" && v.has_attachment) return false;
      if (q) {
        const hay = [v.vendor_name, v.location, v.instagram_handle, v.remarks].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sort) {
        case "date_added_desc": return (b.date_added ?? "").localeCompare(a.date_added ?? "");
        case "date_added_asc": return (a.date_added ?? "").localeCompare(b.date_added ?? "");
        case "updated_desc": return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
        case "name_asc": return a.vendor_name.localeCompare(b.vendor_name, undefined, { sensitivity: "base" });
        case "name_desc": return b.vendor_name.localeCompare(a.vendor_name, undefined, { sensitivity: "base" });
      }
    });
    return sorted;
  }, [vendors, filters, search, sort]);

  // ── Pagination ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / VENDORS_PER_PAGE));
  // Any change to the result set can invalidate the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, filters, sort]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * VENDORS_PER_PAGE, page * VENDORS_PER_PAGE),
    [filtered, page],
  );

  const goToPage = (n: number) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visiblePreviewRepairVendors = useMemo(
    () => paged.filter((v) => v.instagram_handle).slice(0, 48),
    [paged],
  );

  useAutoEnsureMissingPreviews(visiblePreviewRepairVendors, instagramPreviewMap);

  // Clear selection when filters/search change so we don't accidentally edit hidden rows.
  useEffect(() => {
    if (!bulkMode) return;
    setSelectedIds(new Set());
  }, [filters, search, bulkMode]);

  // Drop selections that no longer exist (e.g. after bulk delete).
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(vendors.map((v) => v.id));
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [vendors]);

  const lastAdded = vendors[0]?.vendor_name;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "Visible" means the current page now that the list is paginated — select
  // all should never reach rows the user cannot see.
  const allVisibleSelected =
    paged.length > 0 && paged.every((v) => selectedIds.has(v.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const v of paged) {
        if (allVisibleSelected) next.delete(v.id);
        else next.add(v.id);
      }
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkDialogOpen(false);
  };

  const selectedVendors = useMemo(
    () => vendors.filter((v) => selectedIds.has(v.id)),
    [vendors, selectedIds],
  );

  const busy = bulkUpdate.isPending || bulkDelete.isPending;

  return (
    <div>
      <TopNav
        search={search}
        onSearchChange={setSearch}
        onAddVendor={() => modals.openCreate()}
        totalVendors={vendors.length}
        totalCategories={categories.length}
        lastAdded={lastAdded}
      />



      <div className="mx-auto flex w-full max-w-[1600px]">
        <Sidebar
          vendors={vendors}
          filters={filters}
          onChange={setFilters}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />

        <main className={`min-w-0 flex-1 px-3 py-2 sm:px-6 sm:py-5 lg:px-8 ${bulkMode ? "pb-28" : ""}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
            <div className="flex items-baseline gap-3">
              <h1 className="brand-line hidden font-display text-xl font-semibold text-[var(--charcoal)] sm:block sm:text-2xl">
                {filters.category ?? "All Vendors"}
              </h1>
              <span className="hidden text-xs text-[var(--charcoal)]/70 sm:inline">
                {filtered.length} of {vendors.length}
              </span>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {(() => {
                const filtersActive = !!(filters.category || filters.locations.length || filters.minGoogleRating != null || filters.minSaffronRating != null || filters.submittedViaForm !== "any" || filters.assignedToProject !== "any" || filters.hasQuoteHistory !== "any" || filters.hasAttachment !== "any");
                return (
                  <button
                    onClick={() => setMobileFiltersOpen(true)}
                    aria-label="Filters"
                    title="Filters"
                    className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-medium sm:h-8 sm:w-8 lg:hidden ${
                      filtersActive
                        ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
                        : "border-[var(--border)] bg-white text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                    }`}
                  >
                    <FilterIcon className="h-4 w-4" />
                    {filtersActive && (
                      <span className="absolute right-1 top-1 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--terracotta)]" />
                    )}
                  </button>
                );
              })()}
              <label className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2 text-xs text-[var(--charcoal)]/75 sm:h-auto sm:flex-none sm:py-1.5">

                <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="min-w-0 bg-transparent text-xs text-[var(--charcoal)] focus:outline-none"
                >
                  <option value="date_added_desc">Newest added</option>
                  <option value="date_added_asc">Oldest added</option>
                  <option value="updated_desc">Last modified</option>
                  <option value="name_asc">Name A→Z</option>
                  <option value="name_desc">Name Z→A</option>
                </select>
              </label>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (bulkMode) exitBulkMode();
                    else setBulkMode(true);
                  }}
                  className={`hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors sm:inline-flex ${
                    bulkMode
                      ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
                      : "border-[var(--border)] bg-white text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                  }`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {bulkMode ? "Exit Bulk Edit" : "Bulk Edit"}
                </button>
              )}
              <div className="flex h-9 flex-1 items-center gap-1 rounded-md border border-[var(--border)] bg-white p-1 sm:h-auto sm:flex-none sm:rounded-lg">
                <button
                  onClick={() => setView("cards")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs transition-colors sm:flex-none sm:px-3 ${view === "cards" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium" : "text-[var(--charcoal)]/74 hover:text-[var(--terracotta)]"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Cards
                </button>
                <button
                  onClick={() => setView("table")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs transition-colors sm:flex-none sm:px-3 ${view === "table" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium" : "text-[var(--charcoal)]/74 hover:text-[var(--terracotta)]"}`}
                >
                  <TableIcon className="h-3.5 w-3.5" /> Table
                </button>
              </div>
            </div>
          </div>

          <ActiveFilterChips
            filters={filters}
            onChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            search={search}
            onClearSearch={() => setSearch("")}
          />

          {bulkMode && (
            <div className="mb-4 rounded-md border border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)] px-4 py-2 text-xs text-[var(--terracotta)] animate-fade-in">
              Bulk edit mode is on. Click any card or row to select it. Selection clears when you change filters or search.
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-40" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              category={filters.category}
              vendorsExist={vendors.length > 0}
              onAdd={() => modals.openCreate(filters.category ? { category: filters.category } : undefined)}
            />
          ) : view === "cards" ? (
            <VendorCardGrid
              vendors={paged}
              modals={modals}
              bulkMode={bulkMode}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              previewMap={instagramPreviewMap}
              previewsLoading={instagramPreviewsLoading}
              bothRailsOpen={bothRailsOpen}
            />
          ) : (
            <VendorTable
              vendors={paged}
              onView={modals.openDetail}
              onEdit={modals.openEdit}
              selectMode={bulkMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAllVisible}
            />
          )}

          {filtered.length > 0 && (
            <VendorPagination
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              perPage={VENDORS_PER_PAGE}
              onChange={goToPage}
            />
          )}
        </main>
      </div>

      {bulkMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          visibleCount={paged.length}
          allVisibleSelected={allVisibleSelected}
          onSelectAllVisible={toggleSelectAllVisible}
          onClearSelection={() => setSelectedIds(new Set())}
          onEditFields={() => {
            if (selectedIds.size === 0) {
              toast.error("Pick at least one vendor first.");
              return;
            }
            setBulkDialogOpen(true);
          }}
          onDelete={async () => {
            if (selectedIds.size === 0) return;
            try {
              const ids = Array.from(selectedIds);
              const res = await bulkDelete.mutateAsync(ids);
              toast.success(`Deleted ${res.deleted} vendor${res.deleted === 1 ? "" : "s"}`);
              exitBulkMode();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Bulk delete failed");
            }
          }}
          onCancel={exitBulkMode}
          busy={busy}
        />
      )}

      {bulkDialogOpen && (
        <Suspense fallback={null}>
          <BulkEditDialog
            open={bulkDialogOpen}
            vendors={selectedVendors}
            onClose={() => setBulkDialogOpen(false)}
            onApply={async (patch) => {
              const ids = Array.from(selectedIds);
              const res = await bulkUpdate.mutateAsync({ ids, patch });
              toast.success(`Updated ${res.updated} vendor${res.updated === 1 ? "" : "s"}`);
              exitBulkMode();
            }}
          />
        </Suspense>
      )}

      {modals.state.formOpen && (
        <Suspense fallback={null}>
          <VendorForm
            open={modals.state.formOpen}
            initial={modals.state.editing ?? modals.state.prefill}
            onClose={modals.closeForm}
            onSubmit={async (input) => {
              if (modals.state.editing) {
                const v = await update.mutateAsync({ id: modals.state.editing.id, input });
                toast.success("Vendor updated");
                return v;
              }
              const v = await create.mutateAsync(input);
              toast.success(`${v.vendor_name} added`);
              return v;
            }}
          />
        </Suspense>
      )}

      {modals.state.detail && (
        <Suspense fallback={null}>
          <VendorDetail
            vendor={modals.state.detail}
            vendors={filtered}
            onNavigate={(v) => modals.openDetail(v)}
            onClose={() => {
              modals.closeDetail();
              clearDeepLink();
            }}
            onEdit={() => modals.state.detail && modals.openEdit(modals.state.detail)}
            onDelete={async () => {
              if (modals.state.detail) {
                await remove.mutateAsync(modals.state.detail.id);
                modals.closeDetail();
                clearDeepLink();
              }
            }}
          />
        </Suspense>
      )}

    </div>
  );
}

function EmptyState({
  category, vendorsExist, onAdd,
}: {
  category: string | null;
  vendorsExist: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--champagne)] bg-white py-20 text-center">
      <Sparkles className="mb-3 h-8 w-8 text-[var(--terracotta)] animate-pulse-subtle" />
      <h3 className="font-display text-2xl font-semibold text-[var(--charcoal)]">
        {category ? `No vendors in ${category} yet` : vendorsExist ? "No matching vendors" : "Your vendor book is empty"}
      </h3>
      <p className="mb-5 mt-2 max-w-md text-sm text-[var(--charcoal)]/74">
        {vendorsExist
          ? "Try adjusting filters or add a new vendor in this category."
          : "Start building your vendor book by adding your first vendor."}
      </p>
      <div className="flex gap-2">
        <button onClick={onAdd} className="rounded-lg bg-[var(--terracotta)] px-5 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90">
          Add Vendor →
        </button>
      </div>
    </div>
  );
}

function ActiveFilterChips({
  filters,
  onChange,
  sort,
  onSortChange,
  search,
  onClearSearch,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  search: string;
  onClearSearch: () => void;
}) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (search.trim()) {
    chips.push({ key: "search", label: `Search: "${search.trim()}"`, onRemove: onClearSearch });
  }
  if (filters.category) {
    chips.push({ key: "cat", label: filters.category, onRemove: () => onChange({ ...filters, category: null }) });
  }
  for (const loc of filters.locations) {
    chips.push({
      key: `loc-${loc}`,
      label: loc,
      onRemove: () => onChange({ ...filters, locations: filters.locations.filter((l) => l !== loc) }),
    });
  }
  if (filters.minGoogleRating != null) {
    chips.push({
      key: "google",
      label: `Google ${filters.minGoogleRating}+`,
      onRemove: () => onChange({ ...filters, minGoogleRating: null }),
    });
  }
  if (filters.minSaffronRating != null) {
    chips.push({
      key: "saffron",
      label: `Saffron ${filters.minSaffronRating}+`,
      onRemove: () => onChange({ ...filters, minSaffronRating: null }),
    });
  }
  if (filters.submittedViaForm !== "any") {
    chips.push({
      key: "src",
      label: filters.submittedViaForm === "yes" ? "Form submissions" : "Manual entry",
      onRemove: () => onChange({ ...filters, submittedViaForm: "any" }),
    });
  }
  const relLabels: Record<"hasAttachment" | "hasQuoteHistory" | "assignedToProject", string> = {
    hasAttachment: "Has attachment",
    hasQuoteHistory: "Has quote history",
    assignedToProject: "Assigned to project",
  };
  (Object.keys(relLabels) as Array<keyof typeof relLabels>).forEach((k) => {
    const val = filters[k];
    if (val !== "any") {
      chips.push({
        key: k,
        label: `${relLabels[k]}: ${val === "yes" ? "Yes" : "No"}`,
        onRemove: () => onChange({ ...filters, [k]: "any" }),
      });
    }
  });
  const sortChip =
    sort !== DEFAULT_SORT
      ? { key: "sort", label: `Sort: ${SORT_LABEL[sort]}`, onRemove: () => onSortChange(DEFAULT_SORT) }
      : null;

  if (chips.length === 0 && !sortChip) return null;

  const clearAll = () => {
    onChange({
      category: null,
      locations: [],
      minGoogleRating: null,
      minSaffronRating: null,
      submittedViaForm: "any",
      hasAttachment: "any",
      hasQuoteHistory: "any",
      assignedToProject: "any",
    });
    onClearSearch();
    onSortChange(DEFAULT_SORT);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-[var(--terracotta)]/40 bg-[var(--terracotta-soft)] px-2 py-0.5 text-[11px] text-[var(--terracotta)] hover:border-[var(--terracotta)]"
          title={`Remove ${c.label}`}
        >
          <span>{c.label}</span>
          <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
      {sortChip && (
        <button
          onClick={sortChip.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          title="Reset sort"
        >
          <ArrowUpDown className="h-3 w-3" />
          <span>{sortChip.label}</span>
          <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
        </button>
      )}
      {(chips.length + (sortChip ? 1 : 0)) > 1 && (
        <button
          onClick={clearAll}
          className="ml-1 text-[11px] text-[var(--charcoal)]/70 underline-offset-2 hover:text-[var(--terracotta)] hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/**
 * Numbered pager. Collapses to first / last / a window around the current page
 * with ellipses, so 570 vendors don't produce a six-row strip of numbers.
 */
function VendorPagination({
  page,
  pageCount,
  total,
  perPage,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onChange: (n: number) => void;
}) {
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pages = useMemo(() => {
    const out: (number | "gap")[] = [];
    const push = (n: number | "gap") => out.push(n);
    if (pageCount <= 7) {
      for (let i = 1; i <= pageCount; i++) push(i);
      return out;
    }
    push(1);
    if (page > 3) push("gap");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) push(i);
    if (page < pageCount - 2) push("gap");
    push(pageCount);
    return out;
  }, [page, pageCount]);

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors";

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--charcoal)]/66">
        Showing <span className="font-medium text-[var(--charcoal)]/75">{from}–{to}</span> of{" "}
        <span className="font-medium text-[var(--charcoal)]/75">{total}</span>
      </p>

      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Vendor pages">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className={`${btn} border border-[var(--border)] bg-white text-[var(--charcoal)]/82 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:pointer-events-none disabled:opacity-40`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {pages.map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-[var(--charcoal)]/52">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`${btn} ${
                  p === page
                    ? "bg-[var(--terracotta)] text-[var(--cream)]"
                    : "border border-[var(--border)] bg-white text-[var(--charcoal)]/82 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => onChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Next page"
            className={`${btn} border border-[var(--border)] bg-white text-[var(--charcoal)]/82 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:pointer-events-none disabled:opacity-40`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}

function VendorCardGrid({
  vendors,
  modals,
  bulkMode,
  selectedIds,
  toggleSelect,
  previewMap,
  previewsLoading,
  bothRailsOpen,
}: {
  vendors: import("@/lib/vendor-types").Vendor[];
  modals: ReturnType<typeof useVendorModals>;
  bulkMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  previewMap: Map<string, import("@/lib/instagram-preview.functions").VendorInstagramPreview>;
  previewsLoading: boolean;
  bothRailsOpen: boolean;
}) {
  const allIds = useMemo(() => vendors.map((v) => v.id), [vendors]);
  const idsKey = useMemo(() => allIds.slice().sort().join(","), [allIds]);
  const { data: bookedMap } = useBookedSummaryBulk(allIds, idsKey);

  /**
   * Desktop is driven by rail state, not width: at 1440 with both rails open
   * the grid is ~920px, and at 1280 with one rail open it is ~904px — nearly
   * identical widths that need different column counts, so width alone cannot
   * decide. Below `lg` the rails overlay the content, so width is used there.
   */
  const getColumns = useCallback(
    (width: number) => {
      if (typeof window === "undefined") return 3;
      const vw = window.innerWidth;
      if (vw < 640) return 1; // phone
      if (vw < 1024) return width >= 640 ? 3 : 2; // tablet — rails float over content
      return bothRailsOpen ? 2 : 3;
    },
    [bothRailsOpen],
  );

  return (
    <VirtualGrid
      items={vendors}
      getKey={(v) => v.id}
      getColumns={getColumns}
      estimateRowHeight={460}
      gap={16}
      className="animate-fade-in"
      renderItem={(v) => (
        <div data-focus-id={v.id}>
        <VendorCard
          vendor={v}
          onView={() => modals.openDetail(v)}
          onEdit={() => modals.openEdit(v)}
          selectMode={bulkMode}
          selected={selectedIds.has(v.id)}
          onToggleSelect={() => toggleSelect(v.id)}
          instagramPreview={previewMap.get(v.id) ?? (previewsLoading ? undefined : null)}
          bookedSummary={bookedMap?.[v.id] ?? null}
        />
        </div>
      )}
    />
  );
}



function useBookedSummaryBulk(ids: string[], idsKey: string) {
  return useQuery({
    queryKey: ["vendor-booked-summary-bulk", idsKey],
    queryFn: () => getVendorBookedSummary(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}
