import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";

export const Route = createFileRoute("/client/login")({
  head: () => ({ meta: [{ title: "Client Sign in — Saffron Events" }] }),
  component: ClientLoginPage,
});

function ClientLoginPage() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (session && role === "client") navigate({ to: "/client" });
    else if (session && role && role !== "client") navigate({ to: "/admin" });
  }, [loading, session, role, navigate]);

  return <ClientLoginForm />;
}
