import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandSplash } from "@/components/BrandSplash";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, role, initialized, roleResolutionFailed, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    if (role && role !== "client") {
      navigate({ to: "/admin" });
      return;
    }
    // Session exists but role lookup failed — sign out and bounce home so
    // the user can try again instead of being stranded on the splash.
    if (!role && roleResolutionFailed) {
      void signOut().finally(() => navigate({ to: "/" }));
    }
  }, [initialized, session, role, roleResolutionFailed, navigate, signOut]);

  if (session && role === "client") {
    return <>{children}</>;
  }

  return <BrandSplash />;
}
