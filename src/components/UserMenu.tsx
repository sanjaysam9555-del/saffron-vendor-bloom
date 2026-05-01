import { Link } from "@tanstack/react-router";
import { LogOut, Shield, Briefcase } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function UserMenu() {
  const { user, role, signOut } = useAuth();
  if (!user) return null;
  const isStaff = role === "admin" || role === "employee";
  return (
    <div className="flex items-center gap-2">
      {isStaff && (
        <Link
          to="/admin/projects"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
        >
          <Briefcase className="h-3.5 w-3.5" /> Projects
        </Link>
      )}
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
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] sm:px-2.5"
      >
        <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
