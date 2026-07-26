import { Link } from "@tanstack/react-router";
import { LogOut, Shield, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function AdminLink() {
  const { role } = useAuth();
  if (role !== "admin") return null;
  return (
    <Link
      to="/admin/users"
      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
    >
      <Shield className="h-3.5 w-3.5" /> Admin
    </Link>
  );
}

export function AnalyticsLink() {
  const { role } = useAuth();
  if (role !== "admin") return null;
  return (
    <Link
      to="/admin/analytics"
      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
    >
      <BarChart3 className="h-3.5 w-3.5" /> Analytics
    </Link>
  );
}

export function LogoutButton() {
  const { user, signOut } = useAuth();
  const confirm = useConfirm();
  if (!user) return null;
  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out?",
      description: "You'll need to sign back in to access the dashboard.",
      confirmLabel: "Sign out",
    });
    if (ok) await signOut();
  };
  return (
    <button
      onClick={handleSignOut}
      title="Sign out"
      aria-label="Sign out"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
    >
      <LogOut className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Backwards-compatible default UserMenu — Admin link + icon-only Logout.
 * The admin header composes the parts separately to control ordering.
 */
export function UserMenu() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      <AdminLink />
      <LogoutButton />
    </div>
  );
}
