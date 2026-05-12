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
  const { session, role, initialized, roleResolutionFailed, signOut } = useAuth();
  const navigate = useNavigate();

  const [hasCachedUser, setHasCachedUser] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem("saffron.access.cache.v1");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { role?: string | null };
      return Boolean(parsed?.role);
    } catch {
      return false;
    }
  });

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

  // Role resolution definitively failed for the current session — sign out
  // so we don't sit on the splash and fall through to the login form.
  useEffect(() => {
    if (!initialized || !session || role || !roleResolutionFailed) return;
    void signOut();
  }, [initialized, session, role, roleResolutionFailed, signOut]);

  // Clear stale cache shortly after init if no live session materialised.
  useEffect(() => {
    if (!hasCachedUser) return;
    if (!initialized) return;
    if (session) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.removeItem("saffron.access.cache.v1");
      } catch {
        /* noop */
      }
      setHasCachedUser(false);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [hasCachedUser, initialized, session]);

  if (openingPlate || !initialized) return <BrandSplash showLoading={false} />;
  // Signed-in users with a known role: keep splash visible until redirect fires.
  if (session && role) return <BrandSplash />;
  // Cached user but session not (yet) restored — hold the splash briefly.
  if (hasCachedUser && !roleResolutionFailed) return <BrandSplash />;

  // No session and no cached user — safe to reveal marketing + login form.
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
