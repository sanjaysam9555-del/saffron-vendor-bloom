import { Link, useRouterState } from "@tanstack/react-router";
import { Users, Heart } from "lucide-react";

/**
 * Segmented control in the admin chrome for jumping between the Vendor and
 * Projects panes. Both panes stay mounted in the /admin layout, so switching
 * is a pure CSS visibility toggle — no prefetch needed.
 */
export function DashboardSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onProjects = pathname.startsWith("/admin/projects");

  return (
    <div
      role="tablist"
      aria-label="Dashboard"
      className="inline-flex items-stretch overflow-hidden rounded-md border border-[var(--border)] bg-white text-xs"
    >
      <Link
        to="/admin"
        role="tab"
        aria-selected={!onProjects}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
          !onProjects
            ? "bg-[var(--terracotta)] text-[var(--cream)]"
            : "text-[var(--charcoal)]/70 hover:bg-[var(--cream)]"
        }`}
      >
        <Users className="h-3.5 w-3.5" />
        <span>Vendors</span>
      </Link>
      <Link
        to="/admin/projects"
        role="tab"
        aria-selected={onProjects}
        className={`inline-flex items-center gap-1.5 border-l border-[var(--border)] px-3 py-1.5 transition-colors ${
          onProjects
            ? "bg-[var(--terracotta)] text-[var(--cream)]"
            : "text-[var(--charcoal)]/70 hover:bg-[var(--cream)]"
        }`}
      >
        <Heart className="h-3.5 w-3.5" />
        <span>Projects</span>
      </Link>
    </div>
  );
}
