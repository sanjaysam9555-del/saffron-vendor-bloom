import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, LayoutGrid, Columns3, Filter as FilterIcon } from "lucide-react";
import { ClientGate } from "@/components/ClientGate";
import { useAuth } from "@/lib/auth";
import { getMyProject } from "@/server/projects.functions";
import { ClientTopNav } from "@/components/client/ClientTopNav";
import { ClientSidebar, type ClientFilterState } from "@/components/client/ClientSidebar";
import { ClientVendorCard } from "@/components/client/ClientVendorCard";
import { ClientVendorDetail } from "@/components/client/ClientVendorDetail";
import { ClientBoardView } from "@/components/client/ClientBoardView";
import type { ClientVendor } from "@/lib/project-types";

type ViewMode = "grid" | "board";
const VIEW_STORAGE_KEY = "saffron.client.viewMode";

export const Route = createFileRoute("/client/")({
  head: () => ({ meta: [{ title: "Your Vendors — Saffron Events" }] }),
  component: () => (
    <ClientGate>
      <ClientPortalPage />
    </ClientGate>
  ),
});

function ClientPortalPage() {
  const { signOut } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-project"],
    queryFn: () => getMyProject(),
  });

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ClientFilterState>({ category: null, locations: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<ClientVendor | null>(null);
  const [view, setView] = useState<ViewMode>("grid");

  // Restore + persist view preference.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "board") setView(stored);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const vendors = (data?.vendors ?? []) as ClientVendor[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (filters.category && v.category !== filters.category) return false;
      if (
        filters.locations.length &&
        !filters.locations.some((l) => v.location?.toLowerCase().includes(l.toLowerCase()))
      )
        return false;
      if (q) {
        const hay = [v.vendor_name, v.location, v.instagram_handle, v.subcategory]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, filters, search]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-6">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-sm">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Nothing here yet</h2>
          <p className="mt-2 text-sm text-[var(--charcoal)]/60">
            {error instanceof Error
              ? error.message
              : "Your planner hasn't shared vendors with you yet."}
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--terracotta)]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const { project } = data;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cream)]">
      <ClientTopNav
        search={search}
        onSearchChange={setSearch}
        brideName={project.bride_name}
        groomName={project.groom_name}
        weddingDate={project.wedding_date}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <ClientSidebar
          vendors={vendors}
          filters={filters}
          onChange={setFilters}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-fade-up">
            <div>
              <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
                {filters.category ?? "Welcome"}
              </h1>
              <p className="mt-1 text-sm text-[var(--charcoal)]/65">
                {filters.category
                  ? `${filtered.length} of ${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`
                  : "Here are the vendors we think will be perfect for your wedding."}
              </p>
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
              <div
                role="tablist"
                aria-label="View"
                className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs"
              >
                <button
                  role="tab"
                  aria-selected={view === "grid"}
                  onClick={() => setView("grid")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    view === "grid"
                      ? "bg-[var(--charcoal)] text-[var(--cream)]"
                      : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Grid
                </button>
                <button
                  role="tab"
                  aria-selected={view === "board"}
                  onClick={() => setView("board")}
                  className={`inline-flex items-center gap-1.5 border-l border-[var(--border)] px-3 py-1.5 transition-colors ${
                    view === "board"
                      ? "bg-[var(--charcoal)] text-[var(--cream)]"
                      : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                  }`}
                >
                  <Columns3 className="h-3.5 w-3.5" /> Board
                </button>
              </div>
            </div>
          </div>

          {vendors.length === 0 ? (
            <EmptyState message="Your planner hasn't shared any vendors yet. Check back soon." />
          ) : filtered.length === 0 ? (
            <EmptyState message="No vendors match your filters." />
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:gap-4 animate-fade-in sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((v) => (
                <ClientVendorCard key={v.id} vendor={v} onView={() => setDetail(v)} />
              ))}
            </div>
          ) : (
            <div className="animate-fade-in">
              <ClientBoardView vendors={filtered} onView={(v) => setDetail(v)} />
            </div>
          )}
        </main>
      </div>

      <ClientVendorDetail vendor={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--champagne)] bg-white py-20 text-center animate-fade-up">
      <Sparkles className="mb-3 h-8 w-8 text-[var(--terracotta)] animate-pulse-subtle" />
      <p className="text-sm text-[var(--charcoal)]/60">{message}</p>
    </div>
  );
}
