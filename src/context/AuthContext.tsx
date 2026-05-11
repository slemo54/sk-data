import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, setAccessToken } from '@/lib/auth';
import { createPendingOperator, checkOperatorApproved as checkOperatorApproval } from '@/lib/contactsService';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'operator' | null;

interface AuthContextValue {
  user: User | null;
  role: UserRole;
  loading: boolean;
  isApproved: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractRole(user: User | null): UserRole {
  if (!user) return null;
  // Hardcoded admin for owner email
  if (user.email === 'kim@mammajumboshrimp.com') return 'admin';
  const fromApp = (user.app_metadata?.role as string) ?? null;
  const fromUser = (user.user_metadata?.role as string) ?? null;
  const r = fromApp || fromUser;
  if (r === 'admin' || r === 'operator') return r;
  return 'operator';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setAccessToken(session?.access_token ?? null);
      const u = session?.user ?? null;
      setUser(u);
      setRole(extractRole(u));
      if (u?.email) {
        const approved = await checkOperatorApproval(u.email);
        setIsApproved(approved);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAccessToken(session?.access_token ?? null);
      const u = session?.user ?? null;
      setUser(u);
      setRole(extractRole(u));
      if (u?.email) {
        const approved = await checkOperatorApproval(u.email);
        setIsApproved(approved);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Verifica approvazione per operatori non-admin
    const approved = await checkOperatorApproval(email);
    setIsApproved(approved);
    if (!approved) {
      // Non sloggare, ma mostrare banner in attesa
      return;
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    // Crea richiesta di approvazione
    try {
      await createPendingOperator(email);
    } catch {
      // Ignora errore se l'email è già presente
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, isApproved, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
