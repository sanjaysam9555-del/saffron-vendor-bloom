import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  SignInButton,
  SIGN_IN_ERROR_HOLD_MS,
  type SignInButtonState,
} from "@/components/auth/SignInButton";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Saffron Planning Studio" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, role } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [btnState, setBtnState] = useState<SignInButtonState>("idle");
  const [hydrated, setHydrated] = useState(false);

  // Strip any leaked credentials from the URL the moment the page mounts on
  // the client. This recovers from a pre-hydration GET submit where the form
  // posted email/password as query params.
  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("email") || url.searchParams.has("password")) {
      url.searchParams.delete("email");
      url.searchParams.delete("password");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, []);

  useEffect(() => {
    if (!session || !role) return;
    setBtnState("success");
    navigate({ to: role === "client" ? "/client" : "/admin" });
  }, [session, role, navigate]);

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
      setTimeout(() => setBtnState("idle"), SIGN_IN_ERROR_HOLD_MS);
    } else {
      setBtnState("success");
      window.setTimeout(() => {
        navigate({ to: "/admin" });
      }, 250);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <h1 className="font-display text-3xl text-[var(--terracotta)]">Saffron Planning Studio</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--charcoal)]/55">
          Vendor Studio
        </p>

        <h2 className="mt-6 text-lg font-semibold text-[var(--charcoal)]">Sign in</h2>

        <form onSubmit={submit} method="post" action="/login" className="mt-4 space-y-3" noValidate>
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
          <fieldset disabled={!hydrated} className="contents">
            <SignInButton state={hydrated ? btnState : "loading"} />
          </fieldset>
        </form>

        <div className="mt-5 border-t border-[var(--border)] pt-4 text-center">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.18em] text-[var(--charcoal)]/55 hover:text-[var(--terracotta)] hover:underline"
          >
            Client sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
