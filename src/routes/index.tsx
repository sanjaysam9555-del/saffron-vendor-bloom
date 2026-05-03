import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";
import logo from "@/assets/saffron-events-loader.png";

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

function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cream)]">
      <img
        src={logo}
        alt="Saffron Planning Studio"
        className="h-28 w-auto"
        style={{ animation: "saffron-pulse 1.2s ease-in-out infinite" }}
      />
    </div>
  );
}

function RedirectingLogin() {
  const { session, role, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!session) return;
    if (role === "client") {
      navigate({ to: "/client", replace: true });
    } else if (role === "admin" || role === "employee") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, navigate]);

  // While auth is restoring, OR we have a session whose role/redirect is
  // still in flight, show the branded splash instead of the login form.
  // This prevents the "login screen flash → dashboard" jump on iOS PWA cold boot.
  if (!initialized) return <Splash />;
  if (session) return <Splash />;
  return <ClientLoginForm embedded />;
}
