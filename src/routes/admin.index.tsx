import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Table as TableIcon, Sparkles, CheckSquare, Filter as FilterIcon, ArrowUpDown, X } from "lucide-react";
import { toast } from "sonner";

import { TopNav } from "@/components/vendor/TopNav";
import { Sidebar, type FilterState } from "@/components/vendor/Sidebar";
import { VendorCard } from "@/components/vendor/VendorCard";
import { VendorTable } from "@/components/vendor/VendorTable";
import { VendorForm } from "@/components/vendor/VendorForm";
import { VendorDetail } from "@/components/vendor/VendorDetail";
import { BulkActionBar } from "@/components/vendor/BulkActionBar";
import { BulkEditDialog } from "@/components/vendor/BulkEditDialog";
import { useVendors, useVendorMutations, useVendorModals } from "@/hooks/useVendorData";
import { useAllCategories } from "@/lib/categories";
import { AuthGate } from "@/components/AuthGate";
import { useIsAdmin } from "@/lib/auth";
import { useInstagramPreviewsBulk } from "@/hooks/use-instagram-previews";


type SortKey = "date_added_desc" | "date_added_asc" | "updated_desc" | "name_asc" | "name_desc";

const SORT_LABEL: Record<SortKey, string> = {
  date_added_desc: "Newest added",
  date_added_asc: "Oldest added",
  updated_desc: "Last modified",
  name_asc: "Name A→Z",
  name_desc: "Name Z→A",
};
const DEFAULT_SORT: SortKey = "date_added_desc";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Vendor Dashboard — Saffron Planning Studio" },
      { name: "description", content: "Saffron Planning Studio staff dashboard for managing wedding vendors." },
    ],
  }),
  component: () => (
    <AuthGate>
      <DashboardPage />
    </AuthGate>
  ),
});

function DashboardPage() {
  const isAdmin = useIsAdmin();
  const categories = useAllCategories();
  const { data: vendors = [], isLoading } = useVendors();
  const { create, update, remove, bulkUpdate, bulkDelete } = useVendorMutations();
  const modals = useVendorModals();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filters, setFilters] = useState<FilterState>({
    category: null,
    locations: [],
    minGoogleRating: null,
    minSaffronRating: null,
    submittedViaForm: "any",
  });
  const [sort, setSort] = useState<SortKey>("date_added_desc");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = vendors.filter((v) => {
      if (filters.category && v.category !== filters.category) return false;
      if (filters.locations.length && !filters.locations.some((l) => v.location?.toLowerCase().includes(l.toLowerCase()))) return false;
      if (filters.minGoogleRating != null && (v.google_rating ?? -1) < filters.minGoogleRating) return false;
      if (filters.minSaffronRating != null && (v.saffron_rating ?? -1) < filters.minSaffronRating) return false;
      if (filters.submittedViaForm === "yes" && !v.submitted_via_form) return false;
      if (filters.submittedViaForm === "no" && v.submitted_via_form) return false;
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

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const v of filtered) next.delete(v.id);
        return next;
      }
      const next = new Set(prev);
      for (const v of filtered) next.add(v.id);
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
    <div className="min-h-screen bg-[var(--cream)]">
      <TopNav
        search={search}
        onSearchChange={setSearch}
        onAddVendor={() => modals.openCreate()}
        totalVendors={vendors.length}
        totalCategories={categories.length}
        lastAdded={lastAdded}
      />

      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar
          vendors={vendors}
          filters={filters}
          onChange={setFilters}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />

        <main className={`min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-8 ${bulkMode ? "pb-28" : ""}`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
            <div className="flex items-baseline gap-3">
              <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
                {filters.category ?? "All Vendors"}
              </h1>
              <span className="text-xs text-[var(--charcoal)]/55">
                {filtered.length} of {vendors.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const filtersActive = !!(filters.category || filters.locations.length || filters.minGoogleRating != null || filters.minSaffronRating != null || filters.submittedViaForm !== "any");
                return (
                  <button
                    onClick={() => setMobileFiltersOpen(true)}
                    className={`relative inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium lg:hidden ${
                      filtersActive
                        ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
                        : "border-[var(--border)] bg-white text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                    }`}
                  >
                    <FilterIcon className="h-3.5 w-3.5" />
                    Filters
                    {filtersActive && (
                      <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--terracotta)]" />
                    )}
                  </button>
                );
              })()}
              <label className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-[var(--charcoal)]/75">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="bg-transparent text-xs text-[var(--charcoal)] focus:outline-none"
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
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white p-1">
                <button
                  onClick={() => setView("cards")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs transition-colors ${view === "cards" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium" : "text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Cards
                </button>
                <button
                  onClick={() => setView("table")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs transition-colors ${view === "table" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium" : "text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"}`}
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
                <div key={i} className="h-40 animate-pulse rounded-lg border border-[var(--border)] bg-white" />
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
              vendors={filtered}
              modals={modals}
              bulkMode={bulkMode}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
            />
          ) : (
            <VendorTable
              vendors={filtered}
              onView={modals.openDetail}
              onEdit={modals.openEdit}
              selectMode={bulkMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAllVisible}
            />
          )}
        </main>
      </div>

      {bulkMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          visibleCount={filtered.length}
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

      <VendorDetail
        vendor={modals.state.detail}
        onClose={modals.closeDetail}
        onEdit={() => modals.state.detail && modals.openEdit(modals.state.detail)}
        onDelete={async () => {
          if (modals.state.detail) {
            await remove.mutateAsync(modals.state.detail.id);
            modals.closeDetail();
          }
        }}
      />
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--champagne)] bg-white py-20 text-center animate-fade-up">
      <Sparkles className="mb-3 h-8 w-8 text-[var(--terracotta)] animate-pulse-subtle" />
      <h3 className="font-display text-2xl font-semibold text-[var(--charcoal)]">
        {category ? `No vendors in ${category} yet` : vendorsExist ? "No matching vendors" : "Your vendor book is empty"}
      </h3>
      <p className="mb-5 mt-2 max-w-md text-sm text-[var(--charcoal)]/60">
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
          className="ml-1 text-[11px] text-[var(--charcoal)]/55 underline-offset-2 hover:text-[var(--terracotta)] hover:underline"
        >
          Clear all
        </button>
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
}: {
  vendors: import("@/lib/vendor-types").Vendor[];
  modals: ReturnType<typeof useVendorModals>;
  bulkMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
}) {
  const ids = useMemo(
    () => vendors.filter((v) => v.instagram_handle).map((v) => v.id),
    [vendors],
  );
  const { map: previewMap } = useInstagramPreviewsBulk(ids);

  // One bulk booked-summary fetch for all visible vendors instead of one
  // request per card (which previously caused 100+ network calls on load).
  const allIds = useMemo(() => vendors.map((v) => v.id), [vendors]);
  const idsKey = useMemo(() => allIds.slice().sort().join(","), [allIds]);
  const { data: bookedMap } = useBookedSummaryBulk(allIds, idsKey);

  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in">
      {vendors.map((v) => (
        <VendorCard
          key={v.id}
          vendor={v}
          onView={() => modals.openDetail(v)}
          onEdit={() => modals.openEdit(v)}
          selectMode={bulkMode}
          selected={selectedIds.has(v.id)}
          onToggleSelect={() => toggleSelect(v.id)}
          instagramPreview={previewMap.get(v.id) ?? null}
          bookedSummary={bookedMap?.[v.id] ?? null}
        />
      ))}
    </div>
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
