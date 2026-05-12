import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, role, initialized, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (loading) return;
    if (role && role !== "client") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, loading, navigate]);

  if (session && role === "client") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
      <div className="flex items-center gap-3 text-sm text-[var(--charcoal)]/60">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--terracotta)]" />
        Loading your portal…
      </div>
    </div>
  );
}
