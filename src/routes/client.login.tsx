import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";

export const Route = createFileRoute("/client/login")({
  head: () => ({ meta: [{ title: "Client Sign in — Saffron Planning Studio" }] }),
  component: ClientLoginPage,
});

function ClientLoginPage() {
  const { session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session || !role) return;
    navigate({ to: role === "client" ? "/client" : "/admin" });
  }, [session, role, navigate]);

  return <ClientLoginForm />;
}
