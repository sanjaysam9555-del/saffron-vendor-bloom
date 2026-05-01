import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function ClientLoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await signIn(email, password);
      if (res.error) setErr(res.error);
    } finally {
      setBusy(false);
    }
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
