import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UnifiedLoginForm } from "@/components/auth/UnifiedLoginForm";
import { useAuth, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wedding & Event Planning Studio | Saffron Planning Studio" },
      {
        name: "description",
        content:
          "Boutique wedding & event planning studio in India crafting unforgettable celebrations — from intimate gatherings to grand destination weddings.",
      },
      { property: "og:url", content: "https://planwithsaffron.in/" },
    ],
    links: [
      { rel: "canonical", href: "https://planwithsaffron.in/" },
    ],
  }),
  component: RootIndex,
});

function destinationFor(role: AppRole | null): "/admin" | "/client" | null {
  if (role === "admin" || role === "employee") return "/admin";
  if (role === "client") return "/client";
  return null;
}

function RootIndex() {
  const { initialized, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized || !session) return;
    const dest = destinationFor(role);
    if (dest) navigate({ to: dest, replace: true });
  }, [initialized, session, role, navigate]);

  // While auth is still restoring, or if the user is already signed in and
  // about to be redirected, render an empty cream surface. This prevents the
  // login form's password input from briefly mounting and triggering the iOS
  // keyboard during the auth-restore window.
  if (!initialized || session) {
    return <main className="min-h-screen bg-[var(--cream)]" />;
  }

  return (
    <main className="min-h-screen bg-[var(--cream)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <section className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]">
            Saffron Planning Studio
          </p>
          <h1 className="mt-3 font-display text-3xl text-[var(--charcoal)] sm:text-4xl lg:text-5xl">
            Wedding & Event Planning Studio in India
          </h1>
          <p className="mt-4 max-w-lg text-sm text-[var(--charcoal)]/70 sm:text-base">
            We curate vendors, manage logistics and design weddings end-to-end across
            Delhi NCR and destinations across India. Couples we work with use this portal
            to view their shortlist, share feedback and finalise decisions with their planner.
          </p>
          <div className="mt-6">
            <Link
              to="/vendor-onboarding"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--terracotta)] hover:underline"
            >
              Are you a vendor? Sign up here →
            </Link>
          </div>
        </section>

        <section className="flex flex-col justify-center">
          <UnifiedLoginForm />
        </section>
      </div>
    </main>
  );
}
