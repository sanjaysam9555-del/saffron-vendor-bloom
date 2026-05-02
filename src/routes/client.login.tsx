import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";
import { SIGN_IN_SUCCESS_HOLD_MS } from "@/components/auth/SignInButton";

export const Route = createFileRoute("/client/login")({
  head: () => ({ meta: [{ title: "Client Sign in — Saffron Planning Studio" }] }),
  component: ClientLoginPage,
});

function ClientLoginPage() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !session || !role) return;
    const t = setTimeout(() => {
      navigate({ to: role === "client" ? "/client" : "/admin" });
    }, SIGN_IN_SUCCESS_HOLD_MS);
    return () => clearTimeout(t);
  }, [loading, session, role, navigate]);

  return <ClientLoginForm />;
}
