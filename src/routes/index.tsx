import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";
import { SIGN_IN_SUCCESS_HOLD_MS } from "@/components/auth/SignInButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wedding & Event Planning Studio | Saffron Planning Studio" },
      {
        name: "description",
        content:
          "Saffron Planning Studio is a boutique wedding & event planning studio in India. We craft unforgettable celebrations — from intimate gatherings to grand weddings. Plan with us today.",
      },
      { property: "og:title", content: "Wedding & Event Planning Studio | Saffron Planning Studio" },
      {
        property: "og:description",
        content:
          "Boutique wedding & event planning studio in India. We craft unforgettable celebrations for every occasion.",
      },
    ],
  }),
  component: RootIndex,
});

function RootIndex() {
  return (
    <main className="min-h-screen bg-[var(--cream)]">
      {/* SEO-visible intro — rendered server-side so crawlers can index it. */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-2 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]">
          Saffron Planning Studio
        </p>
        <h1 className="mt-2 font-display text-2xl text-[var(--charcoal)] sm:text-3xl">
          Wedding & Event Planning Studio in India
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--charcoal)]/70">
          We curate vendors, manage logistics and design weddings end-to-end across
          Delhi NCR and destinations across India. Couples we work with use this
          portal to view their shortlist, share feedback and finalise decisions
          with their planner.
        </p>
      </section>

      <div className="px-4 pb-10 pt-3">
        <ClientOnly fallback={<ClientLoginForm embedded />}>
          <RedirectingLogin />
        </ClientOnly>
      </div>
    </main>
  );
}

function RedirectingLogin() {
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
    }, SIGN_IN_SUCCESS_HOLD_MS);
    return () => clearTimeout(t);
  }, [loading, session, role, navigate]);

  return <ClientLoginForm embedded />;
}
