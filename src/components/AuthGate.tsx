import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

/**
 * Gates staff routes. While auth is initializing or access is being
 * resolved, shows a small inline loader (never a full-screen splash that
 * can hang the entire app). When access is denied, redirects to "/".
 */
export function AuthGate({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { session, role, initialized, loading } = useAuth();
  const navigate = useNavigate();

  const isStaff = role === "admin" || role === "employee";
  const passes = requireAdmin ? role === "admin" : isStaff;

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (loading) return; // still resolving role
    if (role === "client") {
      navigate({ to: "/client", replace: true });
      return;
    }
    if (role && requireAdmin && role !== "admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, loading, requireAdmin, navigate]);

  if (session && passes) return <>{children}</>;

  return <InlineLoader />;
}

function InlineLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
      <div className="flex items-center gap-3 text-sm text-[var(--charcoal)]/60">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--terracotta)]" />
        Loading your dashboard…
      </div>
    </div>
  );
}
