import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Table as TableIcon, Sparkles, CheckSquare, Filter as FilterIcon } from "lucide-react";
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
import { CATEGORIES } from "@/lib/categories";
import { AuthGate } from "@/components/AuthGate";
import { useIsAdmin } from "@/lib/auth";

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
  const { data: vendors = [], isLoading } = useVendors();
  const { create, update, remove, bulkUpdate, bulkDelete } = useVendorMutations();
  const modals = useVendorModals();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filters, setFilters] = useState<FilterState>({
    category: null, locations: [],
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (filters.category && v.category !== filters.category) return false;
      if (filters.locations.length && !filters.locations.some((l) => v.location?.toLowerCase().includes(l.toLowerCase()))) return false;
      if (q) {
        const hay = [v.vendor_name, v.location, v.instagram_handle, v.remarks].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, filters, search]);

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
        totalCategories={CATEGORIES.length}
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
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className={`relative inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium lg:hidden ${
                  filters.category || filters.locations.length
                    ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
                    : "border-[var(--border)] bg-white text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                }`}
              >
                <FilterIcon className="h-3.5 w-3.5" />
                Filters
                {(filters.category || filters.locations.length > 0) && (
                  <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--terracotta)]" />
                )}
              </button>
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
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in">
              {filtered.map((v) => (
                <VendorCard
                  key={v.id}
                  vendor={v}
                  onView={() => modals.openDetail(v)}
                  onEdit={() => modals.openEdit(v)}
                  selectMode={bulkMode}
                  selected={selectedIds.has(v.id)}
                  onToggleSelect={() => toggleSelect(v.id)}
                />
              ))}
            </div>
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
            return await update.mutateAsync({ id: modals.state.editing.id, input });
          }
          return await create.mutateAsync(input);
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
