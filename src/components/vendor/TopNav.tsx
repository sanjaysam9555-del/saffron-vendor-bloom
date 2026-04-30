import { Link, useRouterState } from "@tanstack/react-router";
import { Search, Plus, LayoutGrid, Inbox, Upload } from "lucide-react";
import { useEffect, useState } from "react";

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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[oklch(0.16_0.005_60)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--gold)] text-[var(--charcoal)] font-display text-xl font-bold">S</div>
          <div className="leading-tight">
            <div className="font-display text-xl text-[var(--gold)]">Saffron Events</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Vendor Studio</div>
          </div>
        </Link>

        {/* Search */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search vendors, location, IG handle, remarks…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
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
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-white/70 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {mounted && (
            <div className="hidden items-center gap-4 border-l border-white/10 pl-4 text-xs text-white/60 xl:flex">
              <div><span className="text-[var(--gold)] font-semibold">{totalVendors}</span> vendors</div>
              <div><span className="text-[var(--gold)] font-semibold">{totalCategories}</span> categories</div>
              {lastAdded && <div className="truncate max-w-[180px]">Last: {lastAdded}</div>}
            </div>
          )}

          <button
            onClick={onAddVendor}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--gold)] px-3 py-2 text-sm font-medium text-[var(--charcoal)] transition-colors hover:bg-[oklch(0.78_0.115_85)]"
          >
            <Plus className="h-4 w-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 border-t border-white/10 px-4 py-1.5 md:hidden">
        {navItems.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                active ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-white/70"
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
