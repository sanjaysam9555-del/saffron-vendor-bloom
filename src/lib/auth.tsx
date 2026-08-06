import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { getCurrentUserAccess } from "@/lib/auth.functions";

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

export const AuthCtx = createContext<AuthState | undefined>(undefined);

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

function fallbackDisplayName(session: Session): string | null {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta = typeof meta.display_name === "string" ? meta.display_name : null;
  if (fromMeta) return fromMeta;
  const email = session.user.email ?? "";
  return email ? email.split("@")[0] : null;
}

/**
 * Resolve role + display name via the server-side admin resolver. This
 * bypasses browser RLS timing/race issues and works the same for staff
 * and clients.
 */
async function resolveAccess(
  session: Session,
): Promise<{ role: AppRole | null; displayName: string | null }> {
  const access = await getCurrentUserAccess();
  return {
    role: (access?.role as AppRole | null) ?? null,
    displayName: access?.displayName ?? fallbackDisplayName(session),
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const loadedForRef = useRef<string | null>(null);
  const inflightRef = useRef<Promise<AppRole | null> | null>(null);

  const loadAccess = (s: Session): Promise<AppRole | null> => {
    if (inflightRef.current && loadedForRef.current === s.user.id) {
      return inflightRef.current;
    }
    setLoading(true);
    const fallbackName = fallbackDisplayName(s);
    const promise = (async () => {
      try {
        const { role: resolved, displayName: resolvedName } = await resolveAccess(s);
        setRole(resolved);
        setDisplayName(resolvedName ?? fallbackName);
        loadedForRef.current = s.user.id;
        writeCache({ userId: s.user.id, role: resolved, displayName: resolvedName ?? fallbackName });
        return resolved;
      } catch (err) {
        console.error("Access resolution failed", err);
        const cached = readCache();
        if (cached && cached.userId === s.user.id && cached.role) {
          setRole(cached.role);
          setDisplayName(cached.displayName);
          loadedForRef.current = s.user.id;
          return cached.role;
        }
        setRole(null);
        return null;
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    })();
    inflightRef.current = promise;
    return promise;
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const cached = readCache();
        if (cached && cached.userId === s.user.id && cached.role) {
          setRole(cached.role);
          setDisplayName(cached.displayName);
        }
        // Defer Supabase queries OUT of the auth callback to avoid the
        // gotrue-js internal lock deadlocking on nested supabase calls.
        if (loadedForRef.current !== s.user.id) {
          setTimeout(() => {
            if (!mounted) return;
            if (loadedForRef.current !== s.user.id) void loadAccess(s);
          }, 0);
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
        // Mark this user as "being loaded by signIn" so the auth listener
        // skips its own duplicate loadAccess() call.
        loadedForRef.current = data.session.user.id;
        setSession(data.session);
        // Seed display name immediately from metadata to avoid a flash.
        setDisplayName((prev) => prev ?? fallbackDisplayName(data.session));

        const resolvedRole = await loadAccess(data.session);

        if (!resolvedRole) {
          await supabase.auth.signOut();
          return {
            error:
              "This account isn't set up yet. Please contact your Saffron planner if you believe this is a mistake.",
            role: null,
          };
        }

        const isDev = import.meta.env.DEV;
        if (!isDev && (resolvedRole === "admin" || resolvedRole === "employee") && !isStaffEmail(trimmed)) {
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
      } finally {
        if (typeof window !== "undefined") {
          const target = "https://planwithsaffron.in/";
          const here = window.location.host.toLowerCase();
          const sameSite = here === "planwithsaffron.in" || here === "www.planwithsaffron.in";
          if (sameSite) {
            // Already on the marketing domain — stay in-app, no full reload.
            if (window.location.pathname !== "/") {
              window.history.replaceState(null, "", "/");
            }
          } else {
            window.location.replace(target);
          }
        }
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
