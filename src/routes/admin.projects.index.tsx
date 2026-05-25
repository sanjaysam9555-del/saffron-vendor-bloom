import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ArrowUpDown, Archive } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { listProjectsOverview, setProjectArchived, deleteProject } from "@/server/projects.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { ProjectCard, type ProjectCardData } from "@/components/admin/ProjectCard";
import { CreateProjectDialog } from "@/components/admin/CreateProjectDialog";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { useIsAdmin } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate>
      <ProjectsListPage />
    </AuthGate>
  ),
});

type Tab = "active" | "archived";
type SortKey = "upcoming" | "updated" | "most_vendors" | "most_quoted";

function ProjectsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const confirmDelete = useConfirmDelete();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsOverview(),
  });

  useRealtimeInvalidate("admin-projects-live", [
    { table: "projects", invalidate: [["projects"]] },
    { table: "project_vendors", invalidate: [["projects"]] },
    { table: "project_clients", invalidate: [["projects"]] },
    { table: "project_vendor_quotes", invalidate: [["projects"]] },
    { table: "client_vendor_status", invalidate: [["projects"]] },
  ]);

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("upcoming");
  const [showCreate, setShowCreate] = useState(false);

  const { active, archived } = useMemo(() => {
    const active: ProjectCardData[] = [];
    const archived: ProjectCardData[] = [];
    for (const p of projects as ProjectCardData[]) {
      if (p.archived_at) archived.push(p);
      else active.push(p);
    }
    return { active, archived };
  }, [projects]);

  const filtered = useMemo(() => {
    const list = tab === "active" ? active : archived;
    const q = search.trim().toLowerCase();
    const r = !q
      ? list
      : list.filter((p) => {
          const hay = `${p.bride_name} ${p.groom_name} ${p.notes ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
    const sorted = [...r];
    sorted.sort((a, b) => {
      switch (sort) {
        case "upcoming": {
          if (tab === "archived") {
            return (b.archived_at ?? "").localeCompare(a.archived_at ?? "");
          }
          // upcoming first; past at the bottom
          const ad = new Date(a.wedding_date).getTime();
          const bd = new Date(b.wedding_date).getTime();
          const now = Date.now();
          const aPast = ad < now ? 1 : 0;
          const bPast = bd < now ? 1 : 0;
          if (aPast !== bPast) return aPast - bPast;
          return ad - bd;
        }
        case "updated":
          return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
        case "most_vendors":
          return (b.vendor_count ?? 0) - (a.vendor_count ?? 0);
        case "most_quoted":
          return (b.quotes_summary?.total_quotes ?? 0) - (a.quotes_summary?.total_quotes ?? 0);
      }
    });
    return sorted;
  }, [tab, active, archived, search, sort]);

  const handleArchiveToggle = async (id: string, next: boolean) => {
    try {
      await setProjectArchived({ data: { id, archived: next } });
      notifySuccess(next ? "Project archived" : "Project unarchived");
      await qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      notifyError(e, "Could not update project");
    }
  };

  const handleEdit = (id: string) => {
    navigate({ to: "/admin/projects/$id", params: { id } });
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDelete({
      title: "Delete this project?",
      description: "Client logins for this project will also be removed. This cannot be undone.",
      confirmLabel: "Delete project",
    });
    if (!ok) return;
    try {
      await deleteProject({ data: { id } });
      notifySuccess("Project deleted");
      await qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      notifyError(e, "Could not delete project");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]">
          <ArrowLeft className="h-4 w-4" /> Vendor dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-[var(--charcoal)]">Projects</h1>
            <p className="text-sm text-[var(--charcoal)]/60">
              Each project is one wedding. Manage assigned vendors, quotes, and the client portal in one place.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <Plus className="h-4 w-4" /> New project
          </button>
        </div>

        {/* tabs + toolbar */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Projects"
            className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-white text-sm"
          >
            <button
              role="tab"
              aria-selected={tab === "active"}
              onClick={() => setTab("active")}
              className={`px-4 py-1.5 ${tab === "active" ? "bg-[var(--terracotta)] text-[var(--cream)]" : "text-[var(--charcoal)]/70 hover:bg-[var(--cream)]"}`}
            >
              Active <span className="ml-1 opacity-70">({active.length})</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === "archived"}
              onClick={() => setTab("archived")}
              className={`border-l border-[var(--border)] px-4 py-1.5 inline-flex items-center gap-1.5 ${tab === "archived" ? "bg-[var(--terracotta)] text-[var(--cream)]" : "text-[var(--charcoal)]/70 hover:bg-[var(--cream)]"}`}
            >
              <Archive className="h-3.5 w-3.5" />
              Archived <span className="opacity-70">({archived.length})</span>
            </button>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:max-w-md sm:justify-end">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/40" />
              <input
                type="text"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-2 text-sm placeholder:text-[var(--charcoal)]/40 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-[var(--charcoal)]/75">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-transparent text-xs text-[var(--charcoal)] focus:outline-none"
              >
                <option value="upcoming">Upcoming first</option>
                <option value="updated">Recently updated</option>
                <option value="most_vendors">Most vendors</option>
                <option value="most_quoted">Most quoted</option>
              </select>
            </label>
          </div>
        </div>

        {/* cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
            ))
          ) : filtered.length === 0 ? (
            <div className="sm:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-[var(--champagne)] bg-white py-20 text-center">
              <p className="text-sm text-[var(--charcoal)]/60">
                {tab === "active"
                  ? archived.length > 0
                    ? "No active projects. Check the Archived tab."
                    : "No projects yet. Create your first one to get started."
                  : "No archived projects."}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                canDelete={isAdmin}
                onArchiveToggle={handleArchiveToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => navigate({ to: "/admin/projects/$id", params: { id } })}
      />
    </div>
  );
}
