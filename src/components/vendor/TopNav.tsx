import { Link } from "@tanstack/react-router";
import { Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import logoLight from "@/assets/saffron-logo-transparent.png";
import { UserMenu } from "@/components/UserMenu";

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
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:gap-4 sm:px-6">
        {/* Logo */}
        <Link to="/admin" className="flex items-center gap-2.5 shrink-0">
          <img src={logoLight} alt="Saffron Planning Studio" className="hidden h-9 w-auto object-contain sm:block" />
          <div className="leading-tight">
            <div className="font-display text-base font-semibold text-[var(--terracotta)] sm:text-lg">Saffron Planning Studio</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--charcoal)]/55">Vendor Studio</div>
          </div>
        </Link>

        {/* Right cluster — on mobile this fills the row with even spacing */}
        <div className="ml-auto flex flex-1 items-center justify-between gap-2 sm:order-3 sm:ml-auto sm:flex-none sm:justify-end sm:gap-4">
          {mounted && (
            <div className="hidden items-center gap-4 text-xs text-[var(--charcoal)]/60 lg:flex">
              <div><span className="font-semibold text-[var(--terracotta)]">{totalVendors}</span> vendors</div>
              <div><span className="font-semibold text-[var(--terracotta)]">{totalCategories}</span> categories</div>
              {lastAdded && <div className="truncate max-w-[160px]">Last: {lastAdded}</div>}
            </div>
          )}

          <button
            onClick={onAddVendor}
            aria-label="Add Vendor"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-2.5 py-1.5 text-sm font-medium text-[var(--cream)] shadow-sm transition-all hover:bg-[var(--terracotta)]/90 hover:-translate-y-0.5 sm:order-2 sm:px-3.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Vendor</span>
          </button>

          <Link
            to="/admin/submissions"
            className="inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] sm:order-1"
          >
            Submissions
          </Link>

          <div className="sm:order-3">
            <UserMenu />
          </div>
        </div>

        {/* Search — full-width row on mobile, inline on >=sm */}
        <div className="relative order-last w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1 sm:max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/40" />
          <input
            type="text"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-2 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/40 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
          />
        </div>
      </div>
    </header>
  );
}
