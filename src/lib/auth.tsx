import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";

export type AppRole = "admin" | "employee" | "client";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  displayName: string | null;
  loading: boolean;
  /** True once the initial Supabase session restore has completed. */
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: AppRole | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: (opts?: { silent?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

const STAFF_DOMAIN = "saffronevents.in";
const ROLE_CACHE_KEY = "saffron.access.cache.v2";

type CachedAccess = { userId: string; role: AppRole | null; displayName: string | null };

function readCache(): CachedAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROLE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedAccess) : null;
  } catch {
    return null;
  }
}

function writeCache(value: CachedAccess | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    /* noop */
  }
}

function isStaffEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@" + STAFF_DOMAIN);
}

/**
 * Fast access resolution:
 * - Staff-domain email → only check user_roles for admin/employee.
 * - Other email → only check project_clients to confirm client access.
 * Single attempt, fails fast — callers handle retry via UI.
 */
async function resolveAccess(session: Session): Promise<{ role: AppRole | null; displayName: string | null }> {
  const userId = session.user.id;
  const email = session.user.email ?? "";
  const staff = isStaffEmail(email);

  if (staff) {
    const [{ data: roleRow, error: roleError }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "employee"]).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (roleError) throw new Error(roleError.message);
    const role = (roleRow?.role as AppRole | undefined) ?? null;
    return { role, displayName: profileRow?.display_name ?? null };
  }

  // Non-staff: client.
  const [{ data: clientRow, error: clientError }, { data: profileRow }] = await Promise.all([
    supabase.from("project_clients").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
  ]);
  if (clientError) throw new Error(clientError.message);
  return {
    role: clientRow ? ("client" as AppRole) : null,
    displayName: profileRow?.display_name ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const loadedForRef = useRef<string | null>(null);

  const loadAccess = async (s: Session): Promise<AppRole | null> => {
    setLoading(true);
    try {
      const access = await resolveAccess(s);
      setRole(access.role);
      setDisplayName(access.displayName);
      loadedForRef.current = s.user.id;
      writeCache({ userId: s.user.id, role: access.role, displayName: access.displayName });
      return access.role;
    } catch (err) {
      console.error("Access resolution failed", err);
      // Fall back to cache so the user isn't stranded on a transient error.
      const cached = readCache();
      if (cached && cached.userId === s.user.id && cached.role) {
        setRole(cached.role);
        setDisplayName(cached.displayName);
        loadedForRef.current = s.user.id;
        return cached.role;
      }
      setRole(null);
      setDisplayName(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        // Hydrate from cache for instant UI; still revalidate in background.
        const cached = readCache();
        if (cached && cached.userId === s.user.id && cached.role) {
          setRole(cached.role);
          setDisplayName(cached.displayName);
        }
        if (loadedForRef.current !== s.user.id) {
          // Defer to next tick to avoid running inside the auth callback.
          setTimeout(() => { if (mounted) void loadAccess(s); }, 0);
        }
      } else {
        loadedForRef.current = null;
        setRole(null);
        setDisplayName(null);
        setLoading(false);
        writeCache(null);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        setSession(s);
        if (s?.user) {
          const cached = readCache();
          if (cached && cached.userId === s.user.id && cached.role) {
            setRole(cached.role);
            setDisplayName(cached.displayName);
          }
          if (loadedForRef.current !== s.user.id) void loadAccess(s);
        }
        setInitialized(true);
      })
      .catch(async (err) => {
        console.error("getSession failed", err);
        try { await supabase.auth.signOut(); } catch { /* noop */ }
        if (!mounted) return;
        writeCache(null);
        setSession(null);
        setRole(null);
        setDisplayName(null);
        setLoading(false);
        setInitialized(true);
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    role,
    displayName,
    loading,
    initialized,
    signIn: async (email, password) => {
      const trimmed = email.trim();
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
        if (error) {
          setLoading(false);
          return { error: error.message, role: null };
        }
        if (!data?.session || !data?.user) {
          setLoading(false);
          return { error: "Sign in failed. Please try again.", role: null };
        }
        setSession(data.session);
        loadedForRef.current = null;
        const resolvedRole = await loadAccess(data.session);

        if (!resolvedRole) {
          // Account exists but has no access role assigned. Sign them out so
          // they don't sit on a half-authenticated state.
          await supabase.auth.signOut();
          return {
            error:
              "This account isn't set up yet. Please contact your Saffron planner if you believe this is a mistake.",
            role: null,
          };
        }

        // Enforce: staff roles must use a saffronevents.in email.
        if ((resolvedRole === "admin" || resolvedRole === "employee") && !isStaffEmail(trimmed)) {
          await supabase.auth.signOut();
          return {
            error: "Staff accounts must sign in with a saffronevents.in email.",
            role: null,
          };
        }

        notifySuccess("Welcome back", { description: "Signed in successfully." });
        return { error: null, role: resolvedRole };
      } catch (error) {
        console.error("Sign in failed", error);
        setLoading(false);
        return { error: "Could not complete sign in. Please try again.", role: null };
      }
    },
    signUp: async (email, password, name) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: name },
        },
      });
      if (error) notifyError(error.message, "Could not create your account.");
      else notifySuccess("Account created", { description: "Check your email to confirm." });
      return { error: error?.message ?? null };
    },
    signOut: async (opts) => {
      try {
        await supabase.auth.signOut();
        loadedForRef.current = null;
        writeCache(null);
        setSession(null);
        setRole(null);
        setDisplayName(null);
        if (!opts?.silent) notifySuccess("Signed out", { description: "See you again soon." });
      } catch (e) {
        if (!opts?.silent) notifyError(e, "Could not sign out.");
      }
    },
    refresh: async () => {
      if (session?.user) {
        loadedForRef.current = null;
        await loadAccess(session);
      }
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useIsAdmin() {
  return useAuth().role === "admin";
}
