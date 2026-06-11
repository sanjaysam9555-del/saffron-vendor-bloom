import { useEffect, useState } from "react";
import { Compass } from "lucide-react";

interface Props {
  onStart: () => void;
}

const COMPLETED_KEY = "saffron.client.tourCompletedAt";

export function ClientTourButton({ onStart }: Props) {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCompleted(!!window.localStorage.getItem(COMPLETED_KEY));
    const handler = () => setCompleted(!!window.localStorage.getItem(COMPLETED_KEY));
    window.addEventListener("storage", handler);
    window.addEventListener("saffron:tour-completed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("saffron:tour-completed", handler);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onStart}
      data-tour="tour-button"
      title="Take a guided tour"
      aria-label="Take a guided tour"
      className="relative inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] sm:px-3"
    >
      <Compass className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Take a tour</span>
      {completed && (
        <span
          className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--terracotta)]"
          title="You've completed the tour"
          aria-hidden
        />
      )}
    </button>
  );
}

export function markTourCompleted() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPLETED_KEY, new Date().toISOString());
  window.dispatchEvent(new Event("saffron:tour-completed"));
}
