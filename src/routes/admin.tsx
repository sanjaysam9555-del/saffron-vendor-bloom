import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { AdminShellHeader } from "@/components/admin/AdminShellHeader";

/**
 * Pathless-on-purpose layout for everything under /admin/*.
 * Owns the persistent chrome (logo, vendors⇄projects switch, notifications, user menu)
 * so the header never re-mounts when navigating between admin pages.
 */
export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGate>
      <div className="min-h-screen bg-[var(--cream)]">
        <AdminShellHeader />
        <Outlet />
      </div>
    </AuthGate>
  ),
});
