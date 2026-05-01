import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Saffron Events — Client Portal" },
      { name: "description", content: "Sign in to your Saffron Events client portal to view your wedding vendors and planning." },
    ],
  }),
  component: RootIndex,
});

function RootIndex() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) return;
    const t = setTimeout(() => {
      if (role === "client") {
        navigate({ to: "/client" });
      } else if (role === "admin" || role === "employee") {
        navigate({ to: "/admin" });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [loading, session, role, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
        Loading…
      </div>
    );
  }

  if (!session) return <ClientLoginForm />;
  // Signed in — waiting for redirect effect
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
      Loading…
    </div>
  );
}
