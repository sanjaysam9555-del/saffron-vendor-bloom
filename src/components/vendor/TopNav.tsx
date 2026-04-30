import { Link } from "@tanstack/react-router";
import { Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import logoLight from "@/assets/saffron-logo-transparent.png";

interface TopNavProps {
  search: string;
  onSearchChange: (v: string) => void;
  onAddVendor: () => void;
  totalVendors: number;
  totalCategories: number;
  lastAdded?: string;
}

export function TopNav({ search, onSearchChange, onAddVendor, totalVendors, totalCategories, lastAdded }: TopNavProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={logoLight} alt="Saffron Events" className="h-10 w-auto object-contain" />
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

        {/* Stats + CTA */}
        <div className="flex items-center gap-4">
          {mounted && (
            <div className="hidden items-center gap-4 text-xs text-[var(--charcoal)]/60 lg:flex">
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
    </header>
  );
}
