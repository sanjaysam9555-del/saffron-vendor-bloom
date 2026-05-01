import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    if (role && role !== "client") {
      navigate({ to: "/admin" });
    }
  }, [loading, session, role, navigate]);

  if (loading || !session || !role || role !== "client") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
