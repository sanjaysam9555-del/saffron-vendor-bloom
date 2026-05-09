import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandSplash } from "@/components/BrandSplash";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, loading, role, initialized, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized || loading) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    if (role && role !== "client") {
      navigate({ to: "/admin" });
      return;
    }
    // Session exists but role failed to resolve — don't sit on the splash.
    // Sign out and bounce home so the user can try again.
    if (!role) {
      void signOut().finally(() => navigate({ to: "/" }));
    }
  }, [initialized, loading, session, role, navigate, signOut]);

  if (session && role === "client") {
    return <>{children}</>;
  }

  return <BrandSplash />;
}
