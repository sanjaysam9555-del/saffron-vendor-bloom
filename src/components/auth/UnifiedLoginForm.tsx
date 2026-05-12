import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth";
import {
  SignInButton,
  SIGN_IN_ERROR_HOLD_MS,
  type SignInButtonState,
} from "@/components/auth/SignInButton";

function destinationFor(role: AppRole | null): "/admin" | "/client" | null {
  if (role === "admin" || role === "employee") return "/admin";
  if (role === "client") return "/client";
  return null;
}

/**
 * One sign-in form for everyone. Awaits role resolution before navigating
 * so the user never sees a "signed in" state without their dashboard.
 */
export function UnifiedLoginForm({ compact = false }: { compact?: boolean } = {}) {
  const { signIn, session, role, initialized } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [btnState, setBtnState] = useState<SignInButtonState>("idle");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("email") || url.searchParams.has("password")) {
      url.searchParams.delete("email");
      url.searchParams.delete("password");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, []);

  // If a returning visitor lands here already signed in, send straight to dashboard.
  // Skip while we're actively submitting so the explicit navigate after signIn wins.
  useEffect(() => {
    if (submitting) return;
    if (!initialized || !session) return;
    const dest = destinationFor(role);
    if (dest) navigate({ to: dest, replace: true });
  }, [initialized, session, role, navigate, submitting]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (btnState === "loading" || btnState === "success") return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      setErr("Please enter your email and password.");
      setBtnState("error");
      setTimeout(() => setBtnState("idle"), SIGN_IN_ERROR_HOLD_MS);
      return;
    }
    setErr(null);
    setBtnState("loading");
    setSubmitting(true);
    const res = await signIn(email, password);
    if (res.error) {
      setSubmitting(false);
      setErr(res.error);
      setBtnState("error");
      setTimeout(() => setBtnState("idle"), SIGN_IN_ERROR_HOLD_MS);
      return;
    }
    setBtnState("success");
    const dest = destinationFor(res.role);
    if (dest) navigate({ to: dest, replace: true });
    // Leave submitting=true; component will unmount on navigate.
  };

  return (
    <div className={compact ? "w-full" : "w-full max-w-md mx-auto"}>
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-[var(--charcoal)]">Sign in</h2>
        <p className="mt-1 text-sm text-[var(--charcoal)]/60">
          Use the email and password shared by your Saffron planner.
        </p>

        <form onSubmit={submit} method="post" action="/" className="mt-4 space-y-3" noValidate>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none"
            type="email"
            name="email"
            placeholder="Email"
            autoComplete="username"
            defaultValue=""
          />
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none"
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            defaultValue=""
          />
          {err && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          <SignInButton state={btnState} />
        </form>
      </div>
    </div>
  );
}
