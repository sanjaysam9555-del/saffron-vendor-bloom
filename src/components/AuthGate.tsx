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
  const { session, loading, role, initialized, roleResolutionFailed, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    // Role lookup definitively failed for this session — bounce to login
    // instead of sitting on the splash forever.
    if (!loading && !role && roleResolutionFailed) {
      void signOut().finally(() => navigate({ to: "/" }));
      return;
    }
    if (role === "client") {
      navigate({ to: "/client" });
      return;
    }
    if (role && requireAdmin && role !== "admin") {
      navigate({ to: "/admin" });
    }
  }, [initialized, loading, session, role, roleResolutionFailed, requireAdmin, navigate, signOut]);

  const isStaff = role === "admin" || role === "employee";
  const passes = requireAdmin ? role === "admin" : isStaff;

  // Fast path: cached role matches → render immediately.
  if (session && role && passes) {
    return <>{children}</>;
  }

  if (!initialized || loading || !session || !role || !passes) {
    return <BrandSplash />;
  }
  return <>{children}</>;
}
