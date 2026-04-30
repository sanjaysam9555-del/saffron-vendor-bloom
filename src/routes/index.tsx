import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LayoutGrid, Table as TableIcon, Sparkles } from "lucide-react";

import { TopNav } from "@/components/vendor/TopNav";
import { Sidebar, type FilterState } from "@/components/vendor/Sidebar";
import { VendorCard } from "@/components/vendor/VendorCard";
import { VendorTable } from "@/components/vendor/VendorTable";
import { VendorForm } from "@/components/vendor/VendorForm";
import { VendorDetail } from "@/components/vendor/VendorDetail";
import { useVendors, useVendorMutations, useVendorModals } from "@/hooks/useVendorData";
import { CATEGORIES } from "@/lib/categories";
import { bulkInsertVendors } from "@/lib/vendor-api";
import { SAMPLE_VENDORS } from "@/lib/seed-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vendor Dashboard — Saffron Events" },
      { name: "description", content: "Browse, filter, and manage 500+ wedding vendors across 14 categories." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: vendors = [], isLoading } = useVendors();
  const { create, update, remove } = useVendorMutations();
  const modals = useVendorModals();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filters, setFilters] = useState<FilterState>({
    category: null, locations: [], sources: [], tags: [],
  });
  const [seeding, setSeeding] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (filters.category && v.category !== filters.category) return false;
      if (filters.locations.length && !filters.locations.some((l) => v.location?.toLowerCase().includes(l.toLowerCase()))) return false;
      if (filters.sources.length && !filters.sources.includes(v.source ?? "")) return false;
      if (filters.tags.length && !filters.tags.every((t) => v.tags?.includes(t))) return false;
      if (q) {
        const hay = [v.vendor_name, v.location, v.instagram_handle, v.remarks].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, filters, search]);

  const lastAdded = vendors[0]?.vendor_name;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await bulkInsertVendors(SAMPLE_VENDORS);
      window.location.reload();
    } finally {
      setSeeding(false);
    }
  };

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
        <Sidebar vendors={vendors} filters={filters} onChange={setFilters} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-6 flex items-end justify-between gap-4 animate-fade-up">
            <div>
              <h1 className="brand-line font-display text-3xl font-semibold text-[var(--charcoal)]">
                {filters.category ?? "All Vendors"}
              </h1>
              <p className="mt-3 text-sm text-[var(--charcoal)]/60">
                {filtered.length} of {vendors.length} vendors
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white p-1">
              <button
                onClick={() => setView("cards")}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors ${view === "cards" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium" : "text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                onClick={() => setView("table")}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors ${view === "table" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium" : "text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"}`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-lg border border-[var(--border)] bg-white" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              category={filters.category}
              vendorsExist={vendors.length > 0}
              onAdd={() => modals.openCreate(filters.category ? { category: filters.category } : undefined)}
              onSeed={handleSeed}
              seeding={seeding}
            />
          ) : view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in">
              {filtered.map((v) => (
                <VendorCard
                  key={v.id}
                  vendor={v}
                  onView={() => modals.openDetail(v)}
                  onEdit={() => modals.openEdit(v)}
                />
              ))}
            </div>
          ) : (
            <VendorTable vendors={filtered} onView={modals.openDetail} onEdit={modals.openEdit} />
          )}
        </main>
      </div>

      <VendorForm
        open={modals.state.formOpen}
        initial={modals.state.editing ?? modals.state.prefill}
        onClose={modals.closeForm}
        onSubmit={async (input) => {
          if (modals.state.editing) {
            await update.mutateAsync({ id: modals.state.editing.id, input });
          } else {
            await create.mutateAsync(input);
          }
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
  category, vendorsExist, onAdd, onSeed, seeding,
}: {
  category: string | null;
  vendorsExist: boolean;
  onAdd: () => void;
  onSeed: () => void;
  seeding: boolean;
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
          : "Add your first vendor manually or seed sample wedding vendors to get started."}
      </p>
      <div className="flex gap-2">
        <button onClick={onAdd} className="rounded-lg bg-[var(--terracotta)] px-5 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90">
          Add Vendor →
        </button>
        {!vendorsExist && (
          <button onClick={onSeed} disabled={seeding} className="rounded-lg border border-[var(--border)] bg-white px-5 py-2 text-sm text-[var(--charcoal)]/80 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-50">
            {seeding ? "Seeding…" : "Load sample data"}
          </button>
        )}
      </div>
    </div>
  );
}
