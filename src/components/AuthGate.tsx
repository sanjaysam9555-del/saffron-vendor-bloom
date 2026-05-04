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
  const { session, loading, role, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized || loading) return;
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
  }, [initialized, loading, session, role, requireAdmin, navigate]);

  const isStaff = role === "admin" || role === "employee";
  const passes = requireAdmin ? role === "admin" : isStaff;

  // If we already have a session + matching cached role, render immediately
  // even while a background re-check is in flight. This prevents the
  // full-screen "Loading…" flash on every cold boot (especially on iOS PWA).
  if (session && role && passes) {
    return <>{children}</>;
  }

  if (!initialized || loading || !session || !role || !passes) {
    return <BrandSplash />;
  }
  return <>{children}</>;
}
