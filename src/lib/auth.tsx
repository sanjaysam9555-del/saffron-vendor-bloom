import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserAccess } from "@/server/auth.functions";

export type AppRole = "admin" | "employee" | "client";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  displayName: string | null;
  loading: boolean;
  /** True once the initial Supabase session restore has completed (client-side). */
  initialized: boolean;
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
  // `loading` only flips true while we're actively fetching the role for a
  // known user. SSR and the very first paint render with loading=false so
  // public pages (login, marketing) emit real content for SEO.
  const [loading, setLoading] = useState(false);
  // `initialized` is false until the initial getSession() has resolved on the
  // client. Auth gates use THIS (not `loading`) to know whether to wait
  // before redirecting — this prevents a logged-in user from being bounced
  // to "/" during the brief window before the session is restored.
  const [initialized, setInitialized] = useState(false);

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
      } catch (error) {
        console.error("Unable to load access role", error);
        // If we have a cached role for this user, keep it instead of dumping to null.
        const cached = readCachedAccess();
        if (cached && cached.userId === userId && cached.role) {
          setRole(cached.role);
          setDisplayName(cached.displayName);
        } else {
          setRole(null);
          setDisplayName(null);
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
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
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
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
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setLoading(false);
          return { error: error.message };
        }
        setSession(data?.session ?? null);
        if (data?.user) {
          // Force-refresh access for this user.
          loadedForUserRef.current = null;
          void loadProfile(data.user.id);
        } else {
          setLoading(false);
        }
        return { error: null };
      } catch (error) {
        console.error("Sign in failed", error);
        setLoading(false);
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
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
      loadedForUserRef.current = null;
      setRole(null);
      setDisplayName(null);
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
