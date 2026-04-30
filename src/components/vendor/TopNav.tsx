import { Link, useRouterState } from "@tanstack/react-router";
import { Search, Plus, LayoutGrid, Inbox, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import logoLight from "@/assets/saffron-logo-light.jpg";

interface TopNavProps {
  search: string;
  onSearchChange: (v: string) => void;
  onAddVendor: () => void;
  totalVendors: number;
  totalCategories: number;
  lastAdded?: string;
}

export function TopNav({ search, onSearchChange, onAddVendor, totalVendors, totalCategories, lastAdded }: TopNavProps) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const navItems = [
    { to: "/", label: "Vendors", icon: LayoutGrid },
    { to: "/leads", label: "Inbound Leads", icon: Inbox },
    { to: "/import", label: "Import / Export", icon: Upload },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={logoLight} alt="Saffron Events" className="h-10 w-auto rounded-md object-contain" />
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold text-[var(--terracotta)]">Saffron Events</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--charcoal)]/55">Vendor Studio</div>
          </div>
        </Link>

        {/* Search */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--charcoal)]/40" />
          <input
            type="text"
            placeholder="Search vendors, location, IG handle, remarks…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/40 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
          />
        </div>

        {/* Nav + stats */}
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = path === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)] font-medium"
                      : "text-[var(--charcoal)]/70 hover:text-[var(--terracotta)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {mounted && (
            <div className="hidden items-center gap-4 border-l border-[var(--border)] pl-4 text-xs text-[var(--charcoal)]/60 xl:flex">
              <div><span className="font-semibold text-[var(--terracotta)]">{totalVendors}</span> vendors</div>
              <div><span className="font-semibold text-[var(--terracotta)]">{totalCategories}</span> categories</div>
              {lastAdded && <div className="truncate max-w-[180px]">Last: {lastAdded}</div>}
            </div>
          )}

          <button
            onClick={onAddVendor}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] shadow-sm transition-all hover:bg-[var(--terracotta)]/90 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 border-t border-[var(--border)] bg-[var(--cream-deep)] px-4 py-1.5 md:hidden">
        {navItems.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                active ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" : "text-[var(--charcoal)]/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
