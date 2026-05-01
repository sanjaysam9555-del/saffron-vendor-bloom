import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function AuthGate({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { session, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    if (role === "client") {
      navigate({ to: "/client" });
      return;
    }
    if (role && requireAdmin && role !== "admin") {
      navigate({ to: "/admin" });
    }
  }, [loading, session, role, requireAdmin, navigate]);

  // Hard gate: never render protected content unless role matches.
  const isStaff = role === "admin" || role === "employee";
  const passes = requireAdmin ? role === "admin" : isStaff;

  if (loading || !session || !role || !passes) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
