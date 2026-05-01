import { Check, Loader2 } from "lucide-react";

export type SignInButtonState = "idle" | "loading" | "success";

export function SignInButton({ state }: { state: SignInButtonState }) {
  const disabled = state !== "idle";
  return (
    <button
      type="submit"
      disabled={disabled}
      className="relative w-full overflow-hidden rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] transition-all hover:bg-[var(--terracotta)]/90 disabled:opacity-100 data-[state=success]:bg-emerald-600"
      data-state={state}
    >
      <span
        className={`flex items-center justify-center gap-2 transition-all duration-300 ${
          state === "idle" ? "opacity-100" : "opacity-0"
        }`}
      >
        Sign in
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 ${
          state === "loading" ? "opacity-100" : "opacity-0"
        }`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing in…
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 ${
          state === "success" ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 animate-scale-in">
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </span>
        Signed in
      </span>
    </button>
  );
}
