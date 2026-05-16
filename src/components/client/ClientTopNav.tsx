import { LogOut, Search } from "lucide-react";
import logoLight from "@/assets/saffron-logo-transparent.png";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  brideName: string;
  groomName: string;
  weddingDate: string;
}

export function ClientTopNav({ search, onSearchChange, brideName, groomName, weddingDate }: Props) {
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out?",
      description: "You'll need to sign back in to view your vendor folio.",
      confirmLabel: "Sign out",
    });
    if (ok) await signOut();
  };
  const dateFmt = new Date(weddingDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src={logoLight} alt="Saffron Planning Studio" className="h-8 w-auto object-contain sm:h-9" />
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold text-[var(--terracotta)] sm:text-lg">Saffron Planning Studio</div>
            <div className="text-[8px] uppercase tracking-[0.18em] text-[var(--charcoal)]/55 sm:text-[9px] sm:tracking-[0.22em]">Your Vendor Folio</div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:ml-auto sm:gap-4">
          <div className="hidden text-right leading-tight md:block">
            <div className="font-display text-sm font-semibold text-[var(--charcoal)]">
              {brideName} <span className="text-[var(--terracotta)]">&amp;</span> {groomName}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--charcoal)]/55">{dateFmt}</div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] sm:px-3"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        <div className="relative order-last w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1 sm:max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--charcoal)]/40" />
          <input
            type="text"
            placeholder="Search your vendors…"
            aria-label="Search your vendors"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-white py-1.5 pl-8 pr-2 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/40 focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]"
          />
        </div>
      </div>
    </header>
  );
}
