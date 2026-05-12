import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandSplash } from "@/components/BrandSplash";

export function AuthGate({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { session, loading, role, initialized, roleResolutionFailed, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    // Role lookup failed for now — leave the valid session intact and show
    // the login/home screen instead of sitting on the splash forever.
    if (!loading && !role && roleResolutionFailed) {
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
  }, [initialized, loading, session, role, roleResolutionFailed, requireAdmin, navigate]);

  const isStaff = role === "admin" || role === "employee";
  const passes = requireAdmin ? role === "admin" : isStaff;

  // Fast path: cached role matches → render immediately.
  if (session && role && passes) {
    return <>{children}</>;
  }

  if (initialized && session && roleResolutionFailed) {
    return <AccessRetry onRetry={() => void refresh()} />;
  }

  if (!initialized || loading || !session || !role || !passes) {
    return <BrandSplash />;
  }
  return <>{children}</>;
}

function AccessRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-6">
      <div className="max-w-md rounded-xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-2xl text-[var(--charcoal)]">Access is still loading</h1>
        <p className="mt-2 text-sm text-[var(--charcoal)]/65">
          Your sign-in worked, but we couldn't load your dashboard access yet.
        </p>
        <button
          onClick={onRetry}
          className="mt-5 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
