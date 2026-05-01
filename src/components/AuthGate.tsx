import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
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
    if (requireAdmin && role && role !== "admin") {
      navigate({ to: "/" });
    }
  }, [loading, session, role, requireAdmin, navigate]);

  if (loading || !session || (requireAdmin && !role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
        Loading…
      </div>
    );
  }
  if (role === "client") return null;
  if (requireAdmin && role !== "admin") return null;
  return <>{children}</>;
}
