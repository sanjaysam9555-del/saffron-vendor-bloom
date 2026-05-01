import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const loadProfile = async (userId: string) => {
    let access: { role: string; displayName: string | null } | null = null;
    let accessError: Error | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        access = await getCurrentUserAccess();
        accessError = null;
        break;
      } catch (error) {
        accessError = error instanceof Error ? error : new Error("Unable to load access role");
      }

      if (attempt < 7) await wait(Math.min(1500, 350 * (attempt + 1)));
    }

    if (accessError) throw accessError;

    const nextRole = (access?.role as AppRole) ?? "employee";
    setRole(nextRole);
    setDisplayName(access?.displayName ?? null);
    return nextRole;
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setLoading(true);
        setTimeout(() => {
          loadProfile(s.user.id)
            .catch((error) => {
              console.error("Unable to load access role", error);
              setRole(null);
            })
            .finally(() => setLoading(false));
        }, 0);
      } else {
        setRole(null);
        setDisplayName(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id)
          .catch((error) => {
            console.error("Unable to load access role", error);
            setRole(null);
          })
          .finally(() => setLoading(false));
      }
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
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
        let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
        let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] | null = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const response = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          data = response.data;
          error = response.error;
          if (!error || !/database|schema|fetch|network/i.test(error.message)) break;
          if (attempt < 2) await wait(450 * (attempt + 1));
        }

        if (error) return { error: error.message };
        setSession(data?.session ?? null);
        if (data?.user) {
          loadProfile(data.user.id).catch((error) => {
            console.error("Unable to load access role after sign in", error);
            setRole(null);
          });
        }
        return { error: null };
      } catch (error) {
        console.error("Sign in failed", error);
        return { error: "Could not complete sign in. Please try again." };
      } finally {
        setLoading(false);
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
    },
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
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
