import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, role, initialized, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (loading) return;
    if (role === "admin" || role === "employee") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, loading, navigate]);

  if (session && role === "client") return <>{children}</>;

  // Auth resolved but no role at all → account isn't set up. Show a clear
  // message instead of an infinite spinner.
  if (initialized && session && !loading && role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-6">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-sm">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Account not ready</h2>
          <p className="mt-2 text-sm text-[var(--charcoal)]/65">
            We couldn't find a project linked to this account yet. Please contact your
            Saffron planner if you believe this is a mistake.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--terracotta)]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)]">
      <div className="flex items-center gap-3 text-sm text-[var(--charcoal)]/60">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--terracotta)]" />
        Loading your portal…
      </div>
    </div>
  );
}
