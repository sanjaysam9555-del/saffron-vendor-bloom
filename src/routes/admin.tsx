import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { AdminShellHeader } from "@/components/admin/AdminShellHeader";
import { VendorsPane } from "@/routes/admin.index";
import { ProjectsPane } from "@/routes/admin.projects.index";

/**
 * Pathless-on-purpose layout for everything under /admin/*.
 * Owns the persistent chrome AND both top-level tab panes (Vendors + Projects),
 * keeping them mounted across switches so toggling tabs is a pure CSS toggle —
 * no remount, no refetch, state preserved. Detail routes (e.g. /admin/projects/$id,
 * /admin/submissions) render via <Outlet /> and replace the panes when active.
 */
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onVendors = pathname === "/admin" || pathname === "/admin/";
  const onProjects = pathname === "/admin/projects" || pathname === "/admin/projects/";
  const onOther = !onVendors && !onProjects;

  return (
    <AuthGate>
      <div className="min-h-screen bg-[var(--cream)]">
        <AdminShellHeader />
        <div hidden={!onVendors}>
          <VendorsPane />
        </div>
        <div hidden={!onProjects}>
          <ProjectsPane />
        </div>
        {onOther && <Outlet />}
      </div>
    </AuthGate>
  );
}
