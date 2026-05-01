import { Check, Loader2, X } from "lucide-react";

export type SignInButtonState = "idle" | "loading" | "success" | "error";

// Shared timings so every login form animates consistently before navigating
// or resetting after an error.
export const SIGN_IN_SUCCESS_HOLD_MS = 700;
export const SIGN_IN_ERROR_HOLD_MS = 1600;

export function SignInButton({ state }: { state: SignInButtonState }) {
  const disabled = state === "loading" || state === "success";
  return (
    <button
      type="submit"
      disabled={disabled}
      data-state={state}
      className={`relative w-full overflow-hidden rounded-md px-4 py-2 text-sm font-medium text-[var(--cream)] transition-colors duration-300 disabled:opacity-100 ${
        state === "success"
          ? "bg-emerald-600"
          : state === "error"
          ? "bg-red-600 animate-[shake_0.4s_ease-in-out]"
          : "bg-[var(--terracotta)] hover:bg-[var(--terracotta)]/90"
      }`}
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
      <span
        className={`absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 ${
          state === "error" ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 animate-scale-in">
          <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </span>
        Sign in failed
      </span>
    </button>
  );
}
