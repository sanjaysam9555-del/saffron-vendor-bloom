import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";
import { SIGN_IN_SUCCESS_HOLD_MS } from "@/components/auth/SignInButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Saffron Events — Wedding Planning Studio in Delhi" },
      {
        name: "description",
        content:
          "Saffron Events is a Delhi-based wedding planning studio. Sign in to your client portal to view your curated vendor shortlist, track decisions and plan your wedding with us.",
      },
      { property: "og:title", content: "Saffron Events — Wedding Planning Studio" },
      {
        property: "og:description",
        content:
          "A Delhi-based wedding planning studio crafting thoughtful weddings. Sign in to view your vendor portal.",
      },
    ],
  }),
  component: RootIndex,
});

function RootIndex() {
  return (
    <main className="min-h-screen bg-[var(--cream)]">
      {/* SEO-visible intro — rendered server-side so crawlers can index it. */}
      <section className="mx-auto max-w-3xl px-6 pt-12 pb-2 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]">
          Saffron Events
        </p>
        <h1 className="mt-3 font-display text-3xl text-[var(--charcoal)] sm:text-4xl">
          A wedding planning studio for thoughtful celebrations.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--charcoal)]/70">
          We curate vendors, manage logistics and design weddings end-to-end across
          Delhi NCR and destinations across India. Couples we work with use this
          portal to view their shortlist, share feedback and finalise decisions
          with their planner.
        </p>
      </section>

      <div className="px-4 pb-12">
        <ClientOnly fallback={<ClientLoginForm />}>
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

  // Render the form regardless — once redirect fires it'll unmount.
  return <ClientLoginForm />;
}
