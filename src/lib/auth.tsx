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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Default to NOT loading. We only flip to `true` once we know there's a
  // user whose role still needs fetching. This prevents SSR (and the very
  // first client paint) from rendering a spinner — public pages get to
  // render their real content immediately, which Google can index.
  const [loading, setLoading] = useState(false);

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
      } catch (error) {
        console.error("Unable to load access role", error);
        // Don't keep the user stuck on a spinner forever — surface a null role
        // so gates redirect/show the appropriate fallback.
        setRole(null);
        setDisplayName(null);
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
        if (loadedForUserRef.current === s.user.id) {
          // Already loaded for this user — just make sure we aren't stuck loading.
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
        if (loadedForUserRef.current === s.user.id) {
          setLoading(false);
          return;
        }
        setLoading(true);
        void loadProfile(s.user.id);
      } else {
        setLoading(false);
      }
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
