import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/client/login")({
  head: () => ({ meta: [{ title: "Client Sign in — Saffron Events" }] }),
  component: ClientLoginPage,
});

function ClientLoginPage() {
  const { signIn, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && role === "client") navigate({ to: "/client" });
    else if (!loading && session && role && role !== "client") navigate({ to: "/" });
  }, [loading, session, role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setErr(res.error);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <h1 className="font-display text-3xl text-[var(--terracotta)]">Saffron Events</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--charcoal)]/55">
          Client Portal
        </p>

        <h2 className="mt-6 text-lg font-semibold text-[var(--charcoal)]">Welcome — sign in</h2>
        <p className="mt-1 text-sm text-[var(--charcoal)]/60">
          Use the email and password your Saffron Events planner shared with you.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
