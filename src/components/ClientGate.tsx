import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandSplash } from "@/components/BrandSplash";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, loading, role, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized || loading) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    if (role && role !== "client") {
      navigate({ to: "/admin" });
    }
  }, [initialized, loading, session, role, navigate]);

  if (session && role === "client") {
    return <>{children}</>;
  }

  if (!initialized || loading || !session || !role || role !== "client") {
    return <BrandSplash />;
  }
  return <>{children}</>;
}
