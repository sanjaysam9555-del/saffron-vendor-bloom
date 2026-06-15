import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CLIENT_STATUS_OPTIONS,
  getClientStatusOption,
  type ClientVendorStatus,
} from "@/lib/client-status";
import { useSetVendorStatus } from "@/hooks/useSetVendorStatus";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface Props {
  vendorId: string;
  status: ClientVendorStatus | null;
  /** Compact variant for use inside the card grid. */
  compact?: boolean;
}

const POSITIVE_TERMINAL: Set<ClientVendorStatus> = new Set(["finalised"]);

export function ClientStatusSelect({ vendorId, status, compact = false }: Props) {
  const current = getClientStatusOption(status);
  const mutation = useSetVendorStatus();
  const reduced = useReducedMotion();

  // Track previous status to know when to fire the morph + checkmark.
  const prev = useRef<ClientVendorStatus | null | undefined>(undefined);
  const [justChanged, setJustChanged] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (prev.current === undefined) {
      prev.current = status;
      return;
    }
    if (prev.current !== status) {
      setJustChanged(true);
      if (status && POSITIVE_TERMINAL.has(status)) {
        setCelebrate(true);
        const t = window.setTimeout(() => setCelebrate(false), 900);
        const u = window.setTimeout(() => setJustChanged(false), 700);
        prev.current = status;
        return () => {
          window.clearTimeout(t);
          window.clearTimeout(u);
        };
      }
      const u = window.setTimeout(() => setJustChanged(false), 500);
      prev.current = status;
      return () => window.clearTimeout(u);
    }
  }, [status]);

  const handleSelect = (next: ClientVendorStatus | null) => {
    if (next === status) return;
    mutation.mutate({ vendor_id: vendorId, status: next });
  };

  const triggerBase =
    "relative inline-flex items-center justify-between gap-2 rounded-md border-2 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all hover:shadow active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 overflow-hidden";
  const triggerStyle = current
    ? `${current.pill} border-transparent ring-1 ring-black/5`
    : "bg-[var(--charcoal)] text-[var(--cream)] border-[var(--charcoal)] hover:bg-[var(--charcoal)]/90";

  const labelKey = current?.value ?? "none";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={compact ? "inline-flex" : "w-full"}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <motion.button
            type="button"
            className={`${triggerBase} ${triggerStyle} ${compact ? "" : "w-full"}`}
            animate={
              reduced || !justChanged
                ? { scale: 1 }
                : { scale: [1, 1.04, 1] }
            }
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Ring-flash overlay when status changes */}
            <AnimatePresence>
              {justChanged && !reduced && (
                <motion.span
                  aria-hidden
                  initial={{ opacity: 0.7, scale: 0.9 }}
                  animate={{ opacity: 0, scale: 1.15 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-[var(--terracotta)]"
                />
              )}
            </AnimatePresence>

            <span className="relative flex items-center gap-2 truncate">
              <AnimatePresence mode="popLayout" initial={false}>
                {current && (
                  <motion.span
                    key={`dot-${labelKey}`}
                    aria-hidden
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -30 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: 30 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: current.dot }}
                  />
                )}
              </AnimatePresence>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`label-${labelKey}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="truncate"
                >
                  {current ? current.label : "Set your status"}
                </motion.span>
              </AnimatePresence>
            </span>

            {/* Checkmark draw-in on positive terminal (finalised) */}
            <AnimatePresence>
              {celebrate && (
                <motion.span
                  aria-hidden
                  className="relative ml-1 inline-flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
                    />
                  </svg>
                </motion.span>
              )}
            </AnimatePresence>

            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="z-[60] min-w-[12rem]"
          onClick={(e) => e.stopPropagation()}
        >
          {CLIENT_STATUS_OPTIONS.map((opt) => {
            const active = opt.value === status;
            return (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => handleSelect(opt.value)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.dot }}
                  />
                  {opt.label}
                </span>
                {active && <Check className="h-3.5 w-3.5 opacity-70" />}
              </DropdownMenuItem>
            );
          })}
          {status && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleSelect(null)}
                className="text-[var(--charcoal)]/70"
              >
                <X className="mr-2 h-3.5 w-3.5" /> Clear status
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
