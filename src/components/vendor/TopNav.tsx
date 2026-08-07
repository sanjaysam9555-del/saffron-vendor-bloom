import { Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface TopNavProps {
  search: string;
  onSearchChange: (v: string) => void;
  onAddVendor: () => void;
  totalVendors: number;
  totalCategories: number;
  lastAdded?: string;
}

/**
 * Vendor-page secondary toolbar: search vendors, add vendor, quick stats.
 * The persistent admin chrome (wordmark, navigation, notifications, sign out)
 * lives in `AdminSidebar` and is rendered by the `/admin` layout route.
 */
export function TopNav({ search, onSearchChange, onAddVendor, totalVendors, totalCategories, lastAdded }: TopNavProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 h-full px-3 sm:gap-4 sm:px-6">
        <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/58" />
          <input
            type="text"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-2 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/58 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
          />
        </div>

        {mounted && (
          <div className="hidden items-center gap-4 text-xs text-[var(--charcoal)]/74 lg:flex">
            <div><span className="font-semibold text-[var(--terracotta)]">{totalVendors}</span> vendors</div>
            <div><span className="font-semibold text-[var(--terracotta)]">{totalCategories}</span> categories</div>
            {lastAdded && <div className="truncate max-w-[160px]">Last: {lastAdded}</div>}
          </div>
        )}

        <button
          onClick={onAddVendor}
          aria-label="Add Vendor"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-2.5 py-1.5 text-sm font-medium text-[var(--cream)] shadow-sm transition-all hover:bg-[var(--terracotta)]/90 hover:-translate-y-0.5 sm:px-3.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Vendor</span>
        </button>
      </div>
    </div>
  );
}
