import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, KeyRound, Palette, Check, Building2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { getMyProfile, updateMyDisplayName } from "@/lib/profile.functions";
import {
  readTheme,
  writeTheme,
  PRIMARY_COLORS,
  DISPLAY_FONTS,
  type StudioTheme,
} from "@/lib/studio-theme";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin={false}>
      <ProfilePage />
    </AuthGate>
  ),
});

function ProfilePage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: profile, refetch } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <div className="h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">
            Your account and studio appearance.
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Profile
          </h1>
        </div>

        <div className="space-y-6">
          <AccountCard profile={profile} onSaved={refetch} />
          <PasswordCard />
          <AppearanceCard isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}

// ── Shared card shell (mirrors the Admin page section cards) ─────────────────

function SectionCard({
  icon,
  title,
  description,
  children,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-lg bg-[var(--terracotta-soft)] p-2 text-[var(--terracotta)]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-tight text-[var(--charcoal)]">{title}</h2>
            <p className="truncate text-xs text-[var(--charcoal)]/55">{description}</p>
          </div>
        </div>
        {locked && (
          <span className="shrink-0 rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/50">
            Admin only
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const fieldCls =
  "mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none focus:ring-2 focus:ring-[var(--terracotta-soft)]";
const labelCls = "block text-xs font-medium text-[var(--charcoal)]/70";
const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:pointer-events-none disabled:opacity-40";

// ── Account ─────────────────────────────────────────────────────────────────

function AccountCard({
  profile,
  onSaved,
}: {
  profile?: { email: string | null; display_name: string | null; role: string | null };
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (profile && !touched) setName(profile.display_name ?? "");
  }, [profile, touched]);

  const save = async () => {
    setBusy(true);
    try {
      await updateMyDisplayName({ data: { display_name: name.trim() } });
      notifySuccess("Name updated");
      setTouched(false);
      onSaved();
    } catch (e) {
      notifyError(e, "Could not update your name");
    } finally {
      setBusy(false);
    }
  };

  const dirty = touched && name.trim().length > 0 && name.trim() !== (profile?.display_name ?? "");

  return (
    <SectionCard
      icon={<User className="h-4 w-4" />}
      title="Account"
      description="How your name appears across the studio."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          User name
          <input
            className={fieldCls}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
            placeholder="Your name"
          />
        </label>
        <label className={labelCls}>
          Email
          <input
            className={`${fieldCls} bg-[var(--cream)]/60 text-[var(--charcoal)]/55`}
            value={profile?.email ?? ""}
            readOnly
            title="Email is managed by your administrator"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-[var(--charcoal)]/40">
          Role · {profile?.role ?? "—"}
        </span>
        <button onClick={save} disabled={!dirty || busy} className={primaryBtn}>
          <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </SectionCard>
  );
}

// ── Password ────────────────────────────────────────────────────────────────

function PasswordCard() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const tooShort = pwd.length > 0 && pwd.length < 6;
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const canSubmit = pwd.length >= 6 && pwd === confirm && !busy;

  const change = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      notifySuccess("Password changed");
      setPwd("");
      setConfirm("");
    } catch (e) {
      notifyError(e, "Could not change your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      icon={<KeyRound className="h-4 w-4" />}
      title="Change password"
      description="Choose a new password for signing in."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          New password
          <input
            type="password"
            className={fieldCls}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </label>
        <label className={labelCls}>
          Confirm password
          <input
            type="password"
            className={fieldCls}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat it"
            autoComplete="new-password"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--terracotta)]">
          {tooShort ? "Must be at least 6 characters." : mismatch ? "Passwords don't match." : ""}
        </span>
        <button onClick={change} disabled={!canSubmit} className={primaryBtn}>
          <Check className="h-4 w-4" /> {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </SectionCard>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────────

function AppearanceCard({ isAdmin }: { isAdmin: boolean }) {
  const [theme, setTheme] = useState<StudioTheme>(() => readTheme());
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof StudioTheme>(k: K, v: StudioTheme[K]) =>
    setTheme((t) => ({ ...t, [k]: v }));

  const save = () => {
    setBusy(true);
    writeTheme({ ...theme, brandName: theme.brandName.trim() || "Saffron Planning Studio" });
    notifySuccess("Appearance updated");
    setBusy(false);
  };

  if (!isAdmin) {
    return (
      <SectionCard
        icon={<Palette className="h-4 w-4" />}
        title="Appearance"
        description="Studio brand name, colour and font."
        locked
      >
        <p className="text-sm text-[var(--charcoal)]/55">
          Only an administrator can change the studio's branding.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={<Palette className="h-4 w-4" />}
      title="Appearance"
      description="Studio brand name, primary colour and display font."
      locked
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${labelCls} sm:col-span-2`}>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Brand name
          </span>
          <input
            className={fieldCls}
            value={theme.brandName}
            onChange={(e) => set("brandName", e.target.value)}
            placeholder="Saffron Planning Studio"
          />
        </label>

        <label className={labelCls}>
          Primary colour
          <select
            className={fieldCls}
            value={theme.primaryColor}
            onChange={(e) => set("primaryColor", e.target.value)}
          >
            {Object.entries(PRIMARY_COLORS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Primary font
          <select
            className={fieldCls}
            value={theme.displayFont}
            onChange={(e) => set("displayFont", e.target.value)}
          >
            {Object.entries(DISPLAY_FONTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Live preview so a choice can be judged before committing. */}
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--cream)]/50 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/40">
          Preview
        </div>
        <div
          className="mt-1 text-xl font-semibold"
          style={{
            fontFamily: DISPLAY_FONTS[theme.displayFont]?.stack,
            color: PRIMARY_COLORS[theme.primaryColor]?.hsl,
          }}
        >
          {theme.brandName || "Saffron Planning Studio"}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: PRIMARY_COLORS[theme.primaryColor]?.hsl }}
          >
            Primary button
          </span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: PRIMARY_COLORS[theme.primaryColor]?.soft,
              color: PRIMARY_COLORS[theme.primaryColor]?.hsl,
            }}
          >
            Accent chip
          </span>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={busy} className={primaryBtn}>
          <Check className="h-4 w-4" /> Apply
        </button>
      </div>
    </SectionCard>
  );
}
