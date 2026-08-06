import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { ADMIN_SECTIONS } from "@/components/admin/admin-sections";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Admin — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <AdminSettingsHomePage />
    </AuthGate>
  ),
});

function AdminSettingsHomePage() {
  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">Studio-wide settings, data, and access.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Admin
          </h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ADMIN_SECTIONS.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--terracotta)]/50 hover:shadow-md"
            >
              <span className="shrink-0 rounded-lg bg-[var(--terracotta-soft)] p-2.5 text-[var(--terracotta)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base leading-tight text-[var(--charcoal)]">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--charcoal)]/55">{description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--charcoal)]/30 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--terracotta)]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
