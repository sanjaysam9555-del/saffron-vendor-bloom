import { Link, useRouterState } from "@tanstack/react-router";
import { Users, Heart, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Segmented control in the admin chrome for jumping between the Vendor,
 * Projects and (admin-only) Analytics panes.
 */
export function DashboardSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const onProjects = pathname.startsWith("/admin/projects");
  const onAnalytics = pathname.startsWith("/admin/analytics");
  const onVendors = !onProjects && !onAnalytics;

  const base =
    "inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 transition-colors sm:flex-none sm:justify-start";
  const active = "bg-[var(--terracotta)] text-[var(--cream)]";
  const inactive = "text-[var(--charcoal)]/70 hover:bg-[var(--cream)]";

  return (
    <div
      role="tablist"
      aria-label="Dashboard"
      className="flex w-full items-stretch overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs sm:inline-flex sm:w-auto"
    >
      <Link
        to="/admin"
        role="tab"
        aria-selected={onVendors}
        className={`${base} ${onVendors ? active : inactive}`}
      >
        <Users className="h-3.5 w-3.5" />
        <span>Vendors</span>
      </Link>
      <Link
        to="/admin/projects"
        role="tab"
        aria-selected={onProjects}
        className={`${base} border-l border-[var(--border)] ${onProjects ? active : inactive}`}
      >
        <Heart className="h-3.5 w-3.5" />
        <span>Projects</span>
      </Link>
      {isAdmin && (
        <Link
          to="/admin/analytics"
          role="tab"
          aria-selected={onAnalytics}
          className={`${base} border-l border-[var(--border)] ${onAnalytics ? active : inactive}`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Analytics</span>
        </Link>
      )}
    </div>
  );
}
