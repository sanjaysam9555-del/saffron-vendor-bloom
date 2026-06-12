import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { VirtualGrid } from "@/components/ui/VirtualGrid";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  LayoutGrid,
  Columns3,
  Filter as FilterIcon,
  Table as TableIcon,
  Clock,
  Mail,
  Gauge,
  ListChecks,
} from "lucide-react";
import { ClientGate } from "@/components/ClientGate";
import { useAuth } from "@/lib/auth";
import { getMyProject } from "@/lib/projects.functions";
import { listProjectCategoryDeadlines } from "@/lib/project-deadlines.functions";
import { ClientTopNav } from "@/components/client/ClientTopNav";
import { ClientSidebar, type ClientFilterState } from "@/components/client/ClientSidebar";
import { ClientVendorCard } from "@/components/client/ClientVendorCard";
import { ClientSummaryView } from "@/components/client/ClientSummaryView";
import { SectionHelper } from "@/components/client/SectionHelper";
import { useClientTour } from "@/hooks/useClientTour";
const ClientVendorDetail = lazy(() =>
  import("@/components/client/ClientVendorDetail").then((m) => ({ default: m.ClientVendorDetail })),
);
const ClientBoardView = lazy(() =>
  import("@/components/client/ClientBoardView").then((m) => ({ default: m.ClientBoardView })),
);

import { ClientVendorTable } from "@/components/client/ClientVendorTable";
import type { ClientVendor } from "@/lib/project-types";
import { useInstagramPreviewsBulk } from "@/hooks/use-instagram-previews";
import { VendorTimeline } from "@/components/timeline/VendorTimeline";
import { OtherExpensesPanel } from "@/components/timeline/OtherExpensesPanel";

import { buildTimelineItems } from "@/lib/build-timeline-items";


type ViewMode = "summary" | "timeline" | "table" | "category" | "grid" | "board";
const VIEW_STORAGE_KEY = "saffron.client.viewMode";

export const Route = createFileRoute("/client/")({
  head: () => ({
    meta: [
      { title: "Your Vendors — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <ClientGate>
      <ClientPortalPage />
    </ClientGate>
  ),
});

function ClientPortalPage() {
  const { signOut, initialized, session, role } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-project"],
    queryFn: () => getMyProject(),
    enabled: initialized && !!session?.access_token && role === "client",
  });
  const projectId = data?.project?.id;

  useEffect(() => {
    if (!projectId) return;
    let timer: number | undefined;
    const queue = (keys: string[][]) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        for (const k of keys) qc.invalidateQueries({ queryKey: k });
      }, 250);
    };
    const invalidateProject = () => queue([["my-project"]]);
    const invalidateProjectAndQuotes = () =>
      queue([["my-project"], ["client-vendor-quote", projectId]]);
    const invalidateProjectAndComments = () =>
      queue([["my-project"], ["vendor-comments"]]);

    const channel = supabase
      .channel(`client-live-${projectId}`)
      // project_vendor_quotes intentionally NOT subscribed: clients have no SELECT
      // policy on that table; quote data is fetched via server fns. Realtime would
      // deliver nothing to clients anyway and we don't want to risk leaking rows.
      .on("postgres_changes", { event: "*", schema: "public", table: "project_vendor_quote_files" }, invalidateProjectAndQuotes)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_vendor_comments", filter: `project_id=eq.${projectId}` }, invalidateProjectAndComments)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_vendors", filter: `project_id=eq.${projectId}` }, invalidateProject)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_vendor_status" }, invalidateProject)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, invalidateProject)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_category_deadlines", filter: `project_id=eq.${projectId}` }, () => queue([["project-deadlines", projectId]]))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_other_expenses", filter: `project_id=eq.${projectId}` }, () => queue([["project-other-expenses", projectId]]))
      .subscribe();
    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ClientFilterState>({ category: null, locations: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<ClientVendor | null>(null);
  const [view, setView] = useState<ViewMode>("timeline");
  
  const tour = useClientTour({ setView });

  // Restore + persist view preference.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "board" || stored === "table" || stored === "timeline" || stored === "summary" || stored === "category") setView(stored);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    // Keep the active tab visible inside the horizontally scrollable toggle on mobile.
    requestAnimationFrame(() => {
      const el = document.querySelector(
        '[data-tour="view-toggle"] [aria-selected="true"]',
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, [view]);

  // Booking-timeline data
  const { data: deadlines = [] } = useQuery({
    queryKey: ["project-deadlines", projectId],
    queryFn: () => listProjectCategoryDeadlines({ data: { project_id: projectId! } }),
    enabled: !!projectId,
  });
  const timelineItems = useMemo(
    () => buildTimelineItems((data?.vendors ?? []) as ClientVendor[], deadlines, "client"),
    [data?.vendors, deadlines],
  );

  // Refs to category rows so the urgency strip can scroll to them.
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerRowRef = (category: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(category, el);
    else rowRefs.current.delete(category);
  };
  const jumpToCategory = (category: string) => {
    setView("timeline");
    // wait for the timeline to mount
    requestAnimationFrame(() => {
      const el = rowRefs.current.get(category);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const vendors = (data?.vendors ?? []) as ClientVendor[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = vendors.filter((v) => {
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
    // Push rejected vendors to the bottom while preserving relative order.
    return result
      .map((v, i) => ({ v, i }))
      .sort((a, b) => {
        const ar = a.v.client_status === "rejected" ? 1 : 0;
        const br = b.v.client_status === "rejected" ? 1 : 0;
        if (ar !== br) return ar - br;
        return a.i - b.i;
      })
      .map((x) => x.v);
  }, [vendors, filters, search]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
        <div className="flex items-center gap-3 text-sm text-[var(--charcoal)]/60">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--terracotta)]" />
          Loading your vendors…
        </div>
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
        onStartTour={tour.start}
        attentionItems={timelineItems}
        onAttentionChipClick={jumpToCategory}
        onAttentionViewAll={() => setView("timeline")}
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
          search={search}
          onSearchChange={setSearch}
        />


        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="mb-3 flex flex-col items-start gap-3 animate-fade-up sm:flex-row sm:flex-nowrap sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0 w-full sm:w-auto">
              <h1 className="brand-line truncate font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
                {filters.category ?? (
                  <>
                    Welcome, {project.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {project.groom_name}
                  </>
                )}
              </h1>
              {filters.category && (
                <p className="mt-1 text-sm text-[var(--charcoal)]/65 sm:truncate">
                  {`${filtered.length} of ${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`}
                </p>
              )}
            </div>
            <div className="flex w-full shrink-0 items-stretch gap-1.5 sm:w-auto sm:gap-2">
              <button
                data-tour="filters-button"
                onClick={() => setMobileFiltersOpen(true)}
                aria-label="Filters"
                className={`relative inline-flex shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium leading-none sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs lg:hidden ${
                  filters.category || filters.locations.length
                    ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
                    : "border-[var(--border)] bg-white text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                }`}
              >
                <FilterIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {(filters.category || filters.locations.length > 0) && (
                  <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--terracotta)]" />
                )}
              </button>
              
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <div
                  data-tour="view-toggle"
                  role="tablist"
                  aria-label="View"
                  className="no-scrollbar flex snap-x snap-mandatory items-stretch overflow-x-auto rounded-md border border-[var(--border)] bg-white text-[10px] leading-none sm:overflow-visible sm:text-xs"
                >
                  <button
                    data-tour="view-toggle-summary"
                    role="tab"
                    aria-label="Summary"
                    aria-selected={view === "summary"}
                    onClick={() => setView("summary")}
                    className={`inline-flex shrink-0 snap-start items-center justify-center gap-1 whitespace-nowrap px-2.5 py-1.5 transition-colors sm:gap-1.5 ${
                      view === "summary"
                        ? "bg-[var(--charcoal)] text-[var(--cream)]"
                        : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                    }`}
                  >
                    <Gauge className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span>Summary</span>
                  </button>
                  <button
                    data-tour="view-toggle-timeline"
                    role="tab"
                    aria-label="Timeline"
                    aria-selected={view === "timeline"}
                    onClick={() => setView("timeline")}
                    className={`inline-flex shrink-0 snap-start items-center justify-center gap-1 whitespace-nowrap border-l border-[var(--border)] px-2.5 py-1.5 transition-colors sm:gap-1.5 ${
                      view === "timeline"
                        ? "bg-[var(--charcoal)] text-[var(--cream)]"
                        : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                    }`}
                  >
                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span>Timeline</span>
                  </button>
                  <button
                    data-tour="view-toggle-table"
                    role="tab"
                    aria-label="Table"
                    aria-selected={view === "table"}
                    onClick={() => setView("table")}
                    className={`inline-flex shrink-0 snap-start items-center justify-center gap-1 whitespace-nowrap border-l border-[var(--border)] px-2.5 py-1.5 transition-colors sm:gap-1.5 ${
                      view === "table"
                        ? "bg-[var(--charcoal)] text-[var(--cream)]"
                        : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                    }`}
                  >
                    <TableIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span>Table</span>
                  </button>
                  <button
                    data-tour="view-toggle-category"
                    role="tab"
                    aria-label="Category"
                    aria-selected={view === "category"}
                    onClick={() => setView("category")}
                    className={`inline-flex shrink-0 snap-start items-center justify-center gap-1 whitespace-nowrap border-l border-[var(--border)] px-2.5 py-1.5 transition-colors sm:gap-1.5 ${
                      view === "category"
                        ? "bg-[var(--charcoal)] text-[var(--cream)]"
                        : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                    }`}
                  >
                    <ListChecks className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span>Category</span>
                  </button>
                  <button
                    data-tour="view-toggle-grid"
                    role="tab"
                    aria-label="Vendors"
                    aria-selected={view === "grid"}
                    onClick={() => setView("grid")}
                    className={`inline-flex shrink-0 snap-start items-center justify-center gap-1 whitespace-nowrap border-l border-[var(--border)] px-2.5 py-1.5 transition-colors sm:gap-1.5 ${
                      view === "grid"
                        ? "bg-[var(--charcoal)] text-[var(--cream)]"
                        : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                    }`}
                  >
                    <LayoutGrid className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span>Vendors</span>
                  </button>
                  <button
                    data-tour="view-toggle-board"
                    role="tab"
                    aria-label="Board"
                    aria-selected={view === "board"}
                    onClick={() => setView("board")}
                    className={`inline-flex shrink-0 snap-start items-center justify-center gap-1 whitespace-nowrap border-l border-[var(--border)] px-2.5 py-1.5 transition-colors sm:gap-1.5 ${
                      view === "board"
                        ? "bg-[var(--charcoal)] text-[var(--cream)]"
                        : "text-[var(--charcoal)]/65 hover:bg-[var(--cream)]"
                    }`}
                  >
                    <Columns3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span>Board</span>
                  </button>
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-md bg-gradient-to-l from-[var(--cream)] to-transparent sm:hidden"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {view === "summary" && (
            <SectionHelper storageKey="summary">
              <strong className="font-medium text-[var(--charcoal)]">Summary</strong> — a snapshot of your wedding: countdown, vendor progress, booked categories and spend.
            </SectionHelper>
          )}
          {view === "timeline" && (
            <SectionHelper storageKey="timeline">
              <strong className="font-medium text-[var(--charcoal)]">Timeline</strong> — per-category booking deadlines and budgets on a visual track.
            </SectionHelper>
          )}
          {view === "table" && (
            <SectionHelper storageKey="table">
              <strong className="font-medium text-[var(--charcoal)]">Table</strong> — all your vendors in one sortable list. Quick way to compare prices and ratings.
            </SectionHelper>
          )}
          {view === "category" && (
            <SectionHelper storageKey="category">
              <strong className="font-medium text-[var(--charcoal)]">Category</strong> — every wedding category with deadlines, status and budget, perfect for week-by-week planning.
            </SectionHelper>
          )}
          {view === "grid" && (
            <SectionHelper storageKey="grid">
              <strong className="font-medium text-[var(--charcoal)]">Vendors</strong> — browse rich cards with photos. Click any card for details, quotes and comments.
            </SectionHelper>
          )}
          {view === "board" && (
            <SectionHelper storageKey="board">
              <strong className="font-medium text-[var(--charcoal)]">Board</strong> — drag vendors between columns: We like it → Shortlisted → Finalised → Rejected.
            </SectionHelper>
          )}

          {view === "summary" ? (
            <>
              <ClientSummaryView
                vendors={vendors}
                items={timelineItems}
                brideName={project.bride_name}
                groomName={project.groom_name}
                weddingDate={project.wedding_date}
              />
              <OtherExpensesPanel projectId={projectId!} mode="client" />
            </>
          ) : view === "timeline" ? (
            <>
              <VendorTimeline
                projectId={projectId!}
                weddingDate={project.wedding_date}
                items={timelineItems}
                mode="client"
                registerRowRef={registerRowRef}
                forcedSub="timeline"
              />
              <OtherExpensesPanel projectId={projectId!} mode="client" />
            </>
          ) : view === "category" ? (
            <>
              <VendorTimeline
                projectId={projectId!}
                weddingDate={project.wedding_date}
                items={timelineItems}
                mode="client"
                registerRowRef={registerRowRef}
                forcedSub="table"
              />
              <OtherExpensesPanel projectId={projectId!} mode="client" />
            </>
          ) : vendors.length === 0 ? (
            <EmptyState message="Your planner hasn't shared any vendors yet. Check back soon." />
          ) : filtered.length === 0 ? (
            <EmptyState message="No vendors match your filters." />
          ) : view === "grid" ? (
            <ClientVendorGrid vendors={filtered} onView={(v) => setDetail(v)} />
          ) : view === "board" ? (
            <div className="animate-fade-in">
              <Suspense fallback={<div className="h-40" aria-hidden />}>
                <ClientBoardView vendors={filtered} onView={(v) => setDetail(v)} />
              </Suspense>
            </div>
          ) : (
            <ClientVendorTable vendors={filtered} onView={(v) => setDetail(v)} />
          )}
        </main>
      </div>

      <footer className="mt-auto border-t border-[var(--border)] bg-[var(--cream-deep)]">
        <div className="mx-auto flex max-w-[1600px] flex-col items-start gap-2 px-3 py-3 text-xs text-[var(--charcoal)]/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            Need help understanding your folio?{" "}
            <button
              onClick={tour.start}
              className="font-medium text-[var(--terracotta)] underline-offset-2 hover:underline"
            >
              Take the guided tour
            </button>{" "}
            or contact your Saffron planner.
          </span>
          <a
            href="mailto:info@saffronevents.in"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-[var(--charcoal)]/80 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            <Mail className="h-3 w-3" /> info@saffronevents.in
          </a>
        </div>
      </footer>

      {detail && (
        <Suspense fallback={null}>
          <ClientVendorDetail vendor={detail} onClose={() => setDetail(null)} />
        </Suspense>
      )}

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

function ClientVendorGrid({ vendors, onView }: { vendors: ClientVendor[]; onView: (v: ClientVendor) => void }) {
  const ids = useMemo(() => vendors.filter((v) => v.instagram_handle).map((v) => v.id), [vendors]);
  const { map: previewMap, isLoading: previewsLoading } = useInstagramPreviewsBulk(ids);

  return (
    <VirtualGrid
      items={vendors}
      getKey={(v) => v.id}
      estimateRowHeight={460}
      gap={16}
      className="animate-fade-in"
      renderItem={(v) => (
        <ClientVendorCard
          vendor={v}
          onView={() => onView(v)}
          instagramPreview={previewsLoading ? undefined : (previewMap.get(v.id) ?? null)}
        />
      )}
    />
  );
}


