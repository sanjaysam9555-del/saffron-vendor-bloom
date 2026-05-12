import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { UnifiedLoginForm } from "@/components/auth/UnifiedLoginForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wedding & Event Planning Studio | Saffron Planning Studio" },
      {
        name: "description",
        content:
          "Saffron Planning Studio is a boutique wedding & event planning studio in India. We craft unforgettable celebrations — from intimate gatherings to grand weddings.",
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
              to="/vendor-signup"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--terracotta)] hover:underline"
            >
              Are you a vendor? Sign up here →
            </Link>
          </div>
        </section>

        <section className="flex flex-col justify-center">
          <ClientOnly fallback={<LoginSkeleton />}>
            <UnifiedLoginForm />
          </ClientOnly>
        </section>
      </div>
    </main>
  );
}

function LoginSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--cream)]" />
        <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-[var(--cream)]" />
        <div className="mt-6 space-y-3">
          <div className="h-9 animate-pulse rounded bg-[var(--cream)]" />
          <div className="h-9 animate-pulse rounded bg-[var(--cream)]" />
          <div className="h-9 animate-pulse rounded bg-[var(--cream)]" />
        </div>
      </div>
    </div>
  );
}
