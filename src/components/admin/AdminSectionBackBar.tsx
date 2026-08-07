import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ADMIN_SETTINGS_HOME } from "@/components/admin/admin-sections";

/**
 * Replaces the old five-tab strip on each Admin section page. Sections are
 * reached from the Admin hub (a grid of cards) instead of a tab bar, so the
 * list can keep growing (Subscription, etc.) without ever getting crowded.
 */
export function AdminSectionBackBar() {
  return (
    <div className="border-b border-[var(--border)]/60 bg-white">
      <div className="mx-auto flex w-full max-w-[1600px] items-center px-3 py-2.5 sm:px-6">
        <Link
          to={ADMIN_SETTINGS_HOME}
          className="inline-flex items-center gap-1 rounded-md py-1 pl-1 pr-2 text-sm font-medium text-[var(--charcoal)]/74 transition-colors hover:text-[var(--terracotta)]"
        >
          <ChevronLeft className="h-4 w-4" /> Admin
        </Link>
      </div>
    </div>
  );
}
