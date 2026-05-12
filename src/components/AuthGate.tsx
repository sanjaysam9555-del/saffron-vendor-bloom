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
  const { session, role, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (role === "client") {
      navigate({ to: "/client", replace: true });
      return;
    }
    if (role && requireAdmin && role !== "admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, requireAdmin, navigate]);

  const isStaff = role === "admin" || role === "employee";
  const passes = requireAdmin ? role === "admin" : isStaff;

  if (session && role && passes) return <>{children}</>;

  return <BrandSplash />;
}
