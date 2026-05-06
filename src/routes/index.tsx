import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";
import { BrandSplash } from "@/components/BrandSplash";

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
  // SSR HTML for `/` is just the branded splash on a cream background. This
  // way iOS PWA cold boot paints the splash immediately — not a flash of the
  // marketing hero + login form — before React hydrates.
  return (
    <main className="min-h-screen bg-[var(--cream)]">
      <ClientOnly fallback={<BrandSplash showLoading={false} />}>
        <RedirectingLogin />
      </ClientOnly>
    </main>
  );
}

function RedirectingLogin() {
  const { session, role, initialized } = useAuth();
  const navigate = useNavigate();

  // Opening "splash plate" — held briefly so first-time visitors see brand,
  // not a sudden login form, while auth restores from localStorage.
  const [openingPlate, setOpeningPlate] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOpeningPlate(false), 800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!session) return;
    if (role === "client") {
      navigate({ to: "/client", replace: true });
    } else if (role === "admin" || role === "employee") {
      navigate({ to: "/admin", replace: true });
    }
  }, [initialized, session, role, navigate]);

  if (openingPlate || !initialized) return <BrandSplash showLoading={false} />;
  // Signed-in users: keep splash visible while the redirect effect fires.
  if (session) return <BrandSplash />;

  // No session — safe to reveal marketing + login form.
  return (
    <>
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
        <ClientLoginForm embedded />
      </div>
    </>
  );
}
