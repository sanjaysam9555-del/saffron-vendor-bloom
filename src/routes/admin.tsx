import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AdminShellHeader } from "@/components/admin/AdminShellHeader";
import { VendorsPane } from "@/routes/admin.index";
import { ProjectsPane } from "@/routes/admin.projects.index";

/**
 * Pathless-on-purpose layout for everything under /admin/*.
 * Owns the persistent chrome and both top-level tab panes (Vendors + Projects).
 *
 * Panes are mounted lazily on first visit and then KEPT mounted (just toggled
 * via the `hidden` attribute) so subsequent tab switches are pure CSS toggles —
 * no remount, no refetch, state preserved. We avoid mounting a pane while it
 * is hidden because some children (e.g. VirtualGrid) misbehave when measured
 * with zero layout. Detail routes render via <Outlet />.
 */
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onVendors = pathname === "/admin" || pathname === "/admin/";
  const onProjects = pathname === "/admin/projects" || pathname === "/admin/projects/";
  const onOther = !onVendors && !onProjects;

  // Track which top-level panes have been visited; once mounted, keep mounted.
  const [vendorsVisited, setVendorsVisited] = useState(onVendors);
  const [projectsVisited, setProjectsVisited] = useState(onProjects);
  useEffect(() => {
    if (onVendors) setVendorsVisited(true);
    if (onProjects) setProjectsVisited(true);
  }, [onVendors, onProjects]);

  return (
    <AuthGate>
      <div className="min-h-screen bg-[var(--cream)]">
        <AdminShellHeader />
        {vendorsVisited && (
          <div hidden={!onVendors}>
            <VendorsPane />
          </div>
        )}
        {projectsVisited && (
          <div hidden={!onProjects}>
            <ProjectsPane />
          </div>
        )}
        {onOther && <Outlet />}
      </div>
    </AuthGate>
  );
}
