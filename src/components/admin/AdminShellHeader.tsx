import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import logoLight from "@/assets/saffron-logo-transparent.png";
import { UserMenu } from "@/components/UserMenu";
import { DashboardSwitch } from "@/components/admin/DashboardSwitch";

// Defer NotificationsBell — it has its own realtime subscription and data
// fetches that aren't needed for first paint.
const NotificationsBell = lazy(() =>
  import("@/components/admin/NotificationsBell").then((m) => ({ default: m.NotificationsBell })),
);

/**
 * Persistent admin chrome rendered by the `/admin` layout route.
 * Stays mounted across vendor ⇄ projects tab switches so the header never flashes.
 */
export function AdminShellHeader() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-6">
        <Link to="/admin" className="flex items-center gap-2.5 shrink-0">
          <img src={logoLight} alt="Saffron Planning Studio" className="hidden h-9 w-auto object-contain sm:block" />
          <div className="leading-tight">
            <div className="font-display text-base font-semibold text-[var(--terracotta)] sm:text-lg">
              Saffron Planning Studio
            </div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--charcoal)]/55">Planning Studio</div>
          </div>
        </Link>

        <div className="hidden sm:block">
          <DashboardSwitch />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {mounted && (
            <Suspense fallback={<div className="h-8 w-8" aria-hidden />}>
              <NotificationsBell />
            </Suspense>
          )}
          <UserMenu />
        </div>
      </div>
      {/* Mobile dashboard switch sits on its own row */}
      <div className="border-t border-[var(--border)]/60 bg-[var(--cream)]/95 px-3 py-1.5 sm:hidden">
        <DashboardSwitch />
      </div>
    </header>
  );
}
