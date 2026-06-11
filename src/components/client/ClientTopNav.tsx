import { LogOut } from "lucide-react";
import logoLight from "@/assets/saffron-logo-transparent.png";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ClientNotificationsBell } from "./ClientNotificationsBell";
import { ClientTourButton } from "./ClientTourButton";

interface Props {
  onStartTour: () => void;
}

export function ClientTopNav({ onStartTour }: Props) {
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

  return (
    <header
      data-tour="header-greeting"
      className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src={logoLight} alt="Saffron Planning Studio" className="h-8 w-auto object-contain sm:h-9" />
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold text-[var(--terracotta)] sm:text-lg">Saffron Planning Studio</div>
            <div className="text-[8px] uppercase tracking-[0.18em] text-[var(--charcoal)]/55 sm:text-[9px] sm:tracking-[0.22em]">Your Vendor Folio</div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
          <span data-tour="notifications-bell" className="inline-flex">
            <ClientNotificationsBell />
          </span>
          <ClientTourButton onStart={onStartTour} />
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
