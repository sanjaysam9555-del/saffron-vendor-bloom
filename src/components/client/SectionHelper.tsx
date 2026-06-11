import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

interface Props {
  /** Stable key per section (used for localStorage dismissal). */
  storageKey: string;
  children: React.ReactNode;
}

export function SectionHelper({ storageKey, children }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(`saffron.helper.${storageKey}`) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--champagne)] bg-[var(--cream-deep)] px-3 py-2 text-xs text-[var(--charcoal)]/75 animate-fade-in">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
      <span className="flex-1 leading-relaxed">{children}</span>
      <button
        type="button"
        aria-label="Dismiss tip"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(`saffron.helper.${storageKey}`, "1");
          }
          setDismissed(true);
        }}
        className="shrink-0 rounded p-0.5 text-[var(--charcoal)]/45 hover:bg-white hover:text-[var(--terracotta)]"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
