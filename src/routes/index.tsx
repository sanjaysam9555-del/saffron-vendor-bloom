import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
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
  return (
    <main className="min-h-screen bg-[var(--cream)]">
      <ClientOnly fallback={<BrandSplash showLoading={false} />}>
        <Marketing />
      </ClientOnly>
    </main>
  );
}

function Marketing() {
  const { session, role } = useAuth();
  const navigate = useNavigate();

  // Cap the opening splash at 600ms — never block longer than this.
  const [openingPlate, setOpeningPlate] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOpeningPlate(false), 600);
    return () => window.clearTimeout(t);
  }, []);

  // If a signed-in user lands on /, send them to their dashboard.
  useEffect(() => {
    if (!session) return;
    if (role === "client") navigate({ to: "/client", replace: true });
    else if (role === "admin" || role === "employee") navigate({ to: "/admin", replace: true });
  }, [session, role, navigate]);

  if (openingPlate) return <BrandSplash showLoading={false} />;

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]">
          Saffron Planning Studio
        </p>
        <h1 className="mt-3 font-display text-3xl text-[var(--charcoal)] sm:text-4xl">
          Wedding & Event Planning Studio in India
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--charcoal)]/70 sm:text-base">
          We curate vendors, manage logistics and design weddings end-to-end across
          Delhi NCR and destinations across India. Couples we work with use this
          portal to view their shortlist, share feedback and finalise decisions
          with their planner.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="rounded-md bg-[var(--terracotta)] px-6 py-2.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            Sign in
          </Link>
          <Link
            to="/vendor-signup"
            className="rounded-md border border-[var(--border)] bg-white px-6 py-2.5 text-sm font-medium text-[var(--charcoal)] hover:border-[var(--terracotta)]/40"
          >
            Vendor sign up
          </Link>
        </div>
      </section>
    </>
  );
}
