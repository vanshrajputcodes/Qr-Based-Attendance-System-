import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { full_name: string | null; institution: string | null; onboarded: boolean; roll_number: string | null; class: string | null; batch: string | null; course: string | null } | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setRole: (role: AppRole) => Promise<{ error: Error | null }>;
  updateProfile: (data: { full_name?: string; institution?: string; onboarded?: boolean }) => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRoleState] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("full_name, institution, onboarded, roll_number, class, batch, course").eq("user_id", userId).maybeSingle(),
    ]);
    setRoleState(roleRes.data?.role ?? null);
    setProfile(profileRes.data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      if (mounted) setLoading(false);
    });

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setRoleState(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(() => {
          if (mounted) fetchUserData(session.user.id).then(() => { if (mounted) setLoading(false); });
        }, 0);
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const setRole = async (newRole: AppRole) => {
    if (!user) return { error: new Error("Not authenticated") };
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: newRole });
    if (!error) setRoleState(newRole);
    return { error: error as Error | null };
  };

  const updateProfile = async (data: { full_name?: string; institution?: string; onboarded?: boolean; roll_number?: string }) => {
    if (!user) return;
    await supabase.from("profiles").update(data).eq("user_id", user.id);
    const { data: updated } = await supabase.from("profiles").select("full_name, institution, onboarded, roll_number, class, batch, course").eq("user_id", user.id).maybeSingle();
    setProfile(updated ?? null);
  };

  const refreshRole = async () => {
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setRoleState(data?.role ?? null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signUp, signIn, signOut, setRole, updateProfile, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}