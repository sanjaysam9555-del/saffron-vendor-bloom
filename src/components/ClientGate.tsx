import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandSplash } from "@/components/BrandSplash";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, role, initialized, roleResolutionFailed } = useAuth();
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
    // Session exists but role lookup failed for now — preserve the session
    // and bounce home instead of logging the user out.
    if (!role && roleResolutionFailed) {
      navigate({ to: "/" });
    }
  }, [initialized, session, role, roleResolutionFailed, navigate]);

  if (session && role === "client") {
    return <>{children}</>;
  }

  return <BrandSplash />;
}
