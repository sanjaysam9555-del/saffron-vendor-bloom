import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandSplash } from "@/components/BrandSplash";

export function ClientGate({ children }: { children: ReactNode }) {
  const { session, role, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (role && role !== "client") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, navigate]);

  if (session && role === "client") return <>{children}</>;

  return <BrandSplash />;
}
