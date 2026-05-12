import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserAccess } from "@/server/auth.functions";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";

export type AppRole = "admin" | "employee" | "client";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  displayName: string | null;
  loading: boolean;
  /** True once the initial Supabase session restore has completed (client-side). */
  initialized: boolean;
  /** True when we tried to fetch role for the current session and failed with no usable cache. */
  roleResolutionFailed: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

const ACCESS_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { window.clearTimeout(t); resolve(v); },
      (e) => { window.clearTimeout(t); reject(e); },
    );
  });
}

const ROLE_CACHE_KEY = "saffron.access.cache.v1";

type CachedAccess = { userId: string; role: AppRole | null; displayName: string | null };

function readCachedAccess(): CachedAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAccess;
  } catch {
    return null;
  }
}

function writeCachedAccess(value: CachedAccess | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    /* noop */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [roleResolutionFailed, setRoleResolutionFailed] = useState(false);

  // Track which user we've already loaded so onAuthStateChange + getSession
  // don't trigger duplicate parallel server calls.
  const loadedForUserRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const loadProfile = async (userId: string): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async () => {
      try {
        const access = await withTimeout(getCurrentUserAccess(), ACCESS_TIMEOUT_MS);
        const nextRole = (access?.role as AppRole) ?? null;
        setRole(nextRole);
        setDisplayName(access?.displayName ?? null);
        loadedForUserRef.current = userId;
        writeCachedAccess({ userId, role: nextRole, displayName: access?.displayName ?? null });
        setRoleResolutionFailed(!nextRole);
      } catch (error) {
        console.error("Unable to load access role", error);
        const cached = readCachedAccess();
        if (cached && cached.userId === userId && cached.role) {
          setRole(cached.role);
          setDisplayName(cached.displayName);
          setRoleResolutionFailed(false);
        } else {
          setRole(null);
          setDisplayName(null);
          setRoleResolutionFailed(true);
        }
        loadedForUserRef.current = userId;
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      // If a token refresh failed and Supabase signed the user out, make sure
      // we surface that immediately instead of hanging on cached state.
      if (event === "TOKEN_REFRESHED" && !s) {
        writeCachedAccess(null);
      }
      setSession(s);
      if (s?.user) {
        // Hydrate from cache immediately so admin-gated UI renders without waiting.
        const cached = readCachedAccess();
        if (cached && cached.userId === s.user.id && cached.role) {
          setRole(cached.role);
          setDisplayName(cached.displayName);
        }
        if (loadedForUserRef.current === s.user.id) {
          setLoading(false);
          return;
        }
        setLoading(true);
        // Defer to next tick to avoid running inside the auth callback.
        setTimeout(() => {
          if (mounted) void loadProfile(s.user.id);
        }, 0);
      } else {
        loadedForUserRef.current = null;
        setRole(null);
        setDisplayName(null);
        setLoading(false);
        setRoleResolutionFailed(false);
      }
    });

    // Safety net: never let the app sit on the splash forever.
    const safety = window.setTimeout(() => {
      if (mounted) setInitialized(true);
    }, 2500);

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        setSession(s);
        if (s?.user) {
          const cached = readCachedAccess();
          if (cached && cached.userId === s.user.id && cached.role) {
            setRole(cached.role);
            setDisplayName(cached.displayName);
          }
          if (loadedForUserRef.current === s.user.id) {
            setLoading(false);
          } else {
            setLoading(true);
            void loadProfile(s.user.id);
          }
        } else {
          setLoading(false);
        }
        setInitialized(true);
      })
      .catch(async (err) => {
        console.error("getSession failed", err);
        // Likely a corrupt/expired refresh token — clear it so a reload
        // doesn't hit the same wall.
        try {
          await supabase.auth.signOut();
        } catch {
          /* noop */
        }
        if (!mounted) return;
        writeCachedAccess(null);
        setSession(null);
        setRole(null);
        setDisplayName(null);
        setLoading(false);
        setInitialized(true);
        setRoleResolutionFailed(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(safety);
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
    roleResolutionFailed,
    signIn: async (email, password) => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setLoading(false);
          notifyError(error.message, "Could not sign in.");
          return { error: error.message };
        }
        setSession(data?.session ?? null);
        if (data?.user) {
          loadedForUserRef.current = null;
          void loadProfile(data.user.id);
        } else {
          setLoading(false);
        }
        notifySuccess("Welcome back", { description: "Signed in successfully." });
        return { error: null };
      } catch (error) {
        console.error("Sign in failed", error);
        setLoading(false);
        notifyError(error, "Could not complete sign in. Please try again.");
        return { error: "Could not complete sign in. Please try again." };
      }
    },
    signUp: async (email, password, displayName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: displayName },
        },
      });
      if (error) {
        notifyError(error.message, "Could not create your account.");
      } else {
        notifySuccess("Account created", { description: "Check your email to confirm." });
      }
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      try {
        await supabase.auth.signOut();
        loadedForUserRef.current = null;
        writeCachedAccess(null);
        setRole(null);
        setDisplayName(null);
        setRoleResolutionFailed(false);
        notifySuccess("Signed out", { description: "See you again soon." });
      } catch (e) {
        notifyError(e, "Could not sign out.");
      }
    },
    refresh: async () => {
      if (session?.user) {
        loadedForUserRef.current = null;
        await loadProfile(session.user.id);
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
