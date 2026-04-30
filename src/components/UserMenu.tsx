import { Link } from "@tanstack/react-router";
import { LogOut, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function UserMenu() {
  const { user, role, displayName, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      {role === "admin" && (
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
        >
          <Shield className="h-3.5 w-3.5" /> Admin
        </Link>
      )}
      <button
        onClick={() => signOut()}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
      >
        <LogOut className="h-3.5 w-3.5" /> Logout
      </button>
    </div>
  );
}
