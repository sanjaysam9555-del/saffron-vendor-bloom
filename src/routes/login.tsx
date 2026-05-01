import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  SignInButton,
  SIGN_IN_ERROR_HOLD_MS,
  SIGN_IN_SUCCESS_HOLD_MS,
  type SignInButtonState,
} from "@/components/auth/SignInButton";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Saffron Events" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [btnState, setBtnState] = useState<SignInButtonState>("idle");

  useEffect(() => {
    if (loading || !session || !role) return;
    setBtnState("success");
    const t = setTimeout(() => {
      navigate({ to: role === "client" ? "/client" : "/admin" });
    }, SIGN_IN_SUCCESS_HOLD_MS);
    return () => clearTimeout(t);
  }, [loading, session, role, navigate]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (btnState !== "idle") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
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
    const res = await signIn(email, password);
    if (res.error) {
      setErr(res.error);
      setBtnState("error");
      setTimeout(() => setBtnState("idle"), 1600);
    } else {
      setBtnState("success");
      // Actual navigation happens in the useEffect above once role resolves.
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <h1 className="font-display text-3xl text-[var(--terracotta)]">Saffron Events</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--charcoal)]/55">
          Vendor Studio
        </p>

        <h2 className="mt-6 text-lg font-semibold text-[var(--charcoal)]">Sign in</h2>

        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            type="email"
            name="email"
            placeholder="Email"
            autoComplete="username"
            defaultValue=""
          />
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            defaultValue=""
          />
          {err && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          <SignInButton state={btnState} />
        </form>

        <div className="mt-4 text-center text-xs text-[var(--charcoal)]/60">
          New employees are added by an admin.
        </div>
      </div>
    </div>
  );
}
