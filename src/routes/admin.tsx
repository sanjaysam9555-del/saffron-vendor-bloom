import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "@/components/AuthGate";
import { AdminSidebar, AdminMobileTabBar } from "@/components/admin/AdminSidebar";
import { AdminTabStateProvider } from "@/components/admin/admin-tab-state";
import { VendorsPane } from "@/routes/admin.index";
import { ProjectsPane } from "@/routes/admin.projects.index";
import { useAuth } from "@/lib/auth";
import { listVendors } from "@/lib/vendor-api";
import { listProjectsOverview } from "@/lib/projects.functions";

/**
 * Pathless layout for everything under /admin/*.
 *
 * Strategy:
 * - Render only the active pane (vendors OR projects) — never both at once.
 *   Keeping a hidden virtualized grid in the tree was causing intermittent
 *   React update loops via @tanstack/react-virtual + ResizeObserver.
 * - Keep both datasets warm in React Query so tab switches don't show a
 *   loading flash.
 * - Persist the per-tab UI state (search, filters, view, sort, etc.) in
 *   the AdminTabStateProvider so each tab returns exactly as you left it.
 */
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthGate>
      <AdminTabStateProvider>
        <AdminLayoutInner />
      </AdminTabStateProvider>
    </AuthGate>
  );
}

function AdminLayoutInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onVendors = pathname === "/admin" || pathname === "/admin/";
  const onProjects = pathname === "/admin/projects" || pathname === "/admin/projects/";
  const onOther = !onVendors && !onProjects;

  // Warm both top-level queries in the background so switching tabs is
  // instant (cache hit, no loading flash). We don't subscribe — the panes
  // own subscriptions when they mount.
  usePrefetchAdminData();

  return (
    <div className="flex min-h-screen bg-[var(--cream)]">
      <AdminSidebar />
      {/* Main content — offset by sidebar width on desktop only (the sidebar
          itself is an off-canvas drawer below lg, so it must not reserve any
          horizontal space there), top bar height and bottom tab bar height
          on mobile */}
      <div className="flex min-h-screen w-full flex-col pt-14 pb-16 transition-[padding-left] duration-200 lg:pt-0 lg:pb-0 lg:pl-[var(--sidebar-w,200px)]">
        {onVendors && <VendorsPane />}
        {onProjects && <ProjectsPane />}
        {onOther && <Outlet />}
      </div>
      <AdminMobileTabBar />
    </div>
  );
}

function usePrefetchAdminData() {
  const { session, initialized, role } = useAuth();
  const isStaff = role === "admin" || role === "employee";
  const userId = session?.user?.id ?? null;
  const ready = initialized && !!session?.access_token && isStaff;

  // Use useQuery (not prefetchQuery) so it tracks as a subscriber while we
  // sit on /admin/*, keeping the cache warm without manual polling.
  useQuery({
    queryKey: ["vendors", userId],
    queryFn: listVendors,
    enabled: ready,
    staleTime: 60_000,
  });
  useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsOverview(),
    enabled: ready,
    staleTime: 60_000,
  });

}
