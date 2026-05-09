import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Show destructive (red) styling on the confirm button. */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface State {
  open: boolean;
  opts: ConfirmOptions;
}

const DEFAULT_STATE: State = {
  open: false,
  opts: { title: "Are you sure?" },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, opts });
    });
  }, []);

  const finish = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  };

  const {
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
  } = state.opts;

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <AlertDialogContent className="animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finish(true)}
              className={cn(
                destructive &&
                  "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
              )}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Imperative confirm: `const confirm = useConfirm(); if (await confirm({...})) ...`
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

/**
 * Convenience wrapper for the most common case — confirming a destructive
 * action and running the handler if the user confirms. Errors thrown by the
 * handler propagate so callers can show their own toast.
 */
export function useConfirmDelete() {
  const confirm = useConfirm();
  return useCallback(
    async (opts: Omit<ConfirmOptions, "destructive" | "confirmLabel"> & {
      confirmLabel?: string;
    }) => {
      return confirm({
        confirmLabel: opts.confirmLabel ?? "Delete",
        ...opts,
        destructive: true,
      });
    },
    [confirm],
  );
}

/**
 * Tiny inline async-button helper — shows spinner while pending,
 * disabled while pending. Used inside dialogs that perform their own work.
 */
export function PendingDot({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />;
}
