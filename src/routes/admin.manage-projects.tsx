import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ArrowRight, Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AdminSectionBackBar } from "@/components/admin/AdminSectionBackBar";
import { SectionCard, StatTile } from "@/routes/admin.users";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonBlock } from "@/components/ui/LoadingState";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { listProjectsOverview, setProjectArchived, deleteProject } from "@/lib/projects.functions";

export const Route = createFileRoute("/admin/manage-projects")({
  head: () => ({
    meta: [
      { title: "Manage Projects — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <ManageProjectsPage />
    </AuthGate>
  ),
});

function ManageProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirmDelete = useConfirmDelete();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsOverview(),
  });

  const sorted = useMemo(
    () =>
      [...(projects as any[])].sort((a, b) => {
        if (!!a.archived_at !== !!b.archived_at) return a.archived_at ? 1 : -1;
        return new Date(b.wedding_date).getTime() - new Date(a.wedding_date).getTime();
      }),
    [projects],
  );

  const stats = useMemo(() => {
    const active = (projects as any[]).filter((p) => !p.archived_at);
    const archived = (projects as any[]).filter((p) => p.archived_at);
    const now = Date.now();
    const upcoming = active.filter((p) => new Date(p.wedding_date).getTime() >= now);
    return { total: projects.length, active: active.length, archived: archived.length, upcoming: upcoming.length };
  }, [projects]);

  const handleArchiveToggle = async (id: string, next: boolean) => {
    try {
      await setProjectArchived({ data: { id, archived: next } });
      notifySuccess(next ? "Project archived" : "Project unarchived");
      await qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      notifyError(e, "Could not update project");
    }
  };

  const handleDelete = async (id: string, label: string) => {
    const ok = await confirmDelete({
      title: `Delete ${label}?`,
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
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <AdminSectionBackBar />

      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">Create, edit, archive, or delete wedding projects.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Manage Projects
          </h1>
        </div>

        <div className="space-y-6">
          <SectionCard
            icon={<Heart className="h-4 w-4" />}
            title="Projects"
            description="Every project, with quick edit, archive, and delete actions."
            action={
              <Link
                to="/admin/projects"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
              >
                Open Projects <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)] sm:grid-cols-4 sm:divide-y-0">
              <StatTile label="Total projects" value={stats.total} />
              <StatTile label="Active" value={stats.active} />
              <StatTile label="Upcoming weddings" value={stats.upcoming} />
              <StatTile label="Archived" value={stats.archived} />
            </div>

            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState compact icon={<Heart />} title="No projects yet" description="Create your first project from the Projects workspace." />
            ) : (
              <div className="overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
                    <tr>
                      <th className="px-4 py-2.5">Project</th>
                      <th className="px-4 py-2.5">Wedding date</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p) => {
                      const label = `${p.bride_name} & ${p.groom_name}`;
                      const archived = !!p.archived_at;
                      return (
                        <tr key={p.id} className="border-t border-[var(--border)]">
                          <td className="px-4 py-3 text-[var(--charcoal)]">{label}</td>
                          <td className="px-4 py-3 text-[var(--charcoal)]/70">
                            {new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${archived ? "bg-[var(--cream)] text-[var(--charcoal)]/70" : "bg-[var(--terracotta-soft)] text-[var(--terracotta)]"}`}>
                              {archived ? "Archived" : "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => navigate({ to: "/admin/projects/$id", params: { id: p.id } })}
                                title="Edit project"
                                className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleArchiveToggle(p.id, !archived)}
                                title={archived ? "Unarchive project" : "Archive project"}
                                className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
                              >
                                {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => handleDelete(p.id, label)}
                                title="Delete project"
                                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<Archive className="h-4 w-4" />}
            title="Archiving vs. deleting"
            description="A quick reminder before you remove anything."
          >
            <p className="px-4 py-4 text-sm text-[var(--charcoal)]/65 sm:px-5">
              <strong>Archive</strong> hides a project from the active list without losing any data — reversible any time
              from the project's card. <strong>Delete</strong> is permanent: it removes the project and every client login
              tied to it. Deleting is admin-only and asks for confirmation first.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
