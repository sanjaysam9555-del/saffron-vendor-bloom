import { Link, useRouterState } from "@tanstack/react-router";
import { Users, Heart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { listProjectsOverview } from "@/server/projects.functions";

/**
 * Segmented control in the admin chrome for jumping between the
 * Vendor Dashboard and the Projects Dashboard.
 *
 * Prefetches the projects list on hover/focus so the swap feels instant —
 * combined with the persistent `/admin` layout, the header never re-mounts.
 */
export function DashboardSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onProjects = pathname.startsWith("/admin/projects");
  const qc = useQueryClient();

  const prefetchProjects = () => {
    qc.prefetchQuery({
      queryKey: ["projects"],
      queryFn: () => listProjectsOverview(),
      staleTime: 30_000,
    });
  };

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
        onMouseEnter={prefetchProjects}
        onFocus={prefetchProjects}
        onTouchStart={prefetchProjects}
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
