"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Session, Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { API_URL } from "@/lib/apiUrl";

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signInWithOAuth: (provider: "google" | "github" | "twitter") => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function signupSourceFromProvider(provider: Provider): string {
  if (provider === "google") return "google";
  if (provider === "github") return "github";
  if (provider === "twitter") return "twitter";
  return "oauth";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const provider = (session.user.app_metadata?.provider as Provider) || "oauth";
        fetch(`${API_URL}/api/users/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authUserId: session.user.id,
            signupSource: signupSourceFromProvider(provider),
          }),
        }).catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithOAuth = async (provider: "google" | "github" | "twitter") => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signInWithOAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
