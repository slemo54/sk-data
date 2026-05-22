import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, setAccessToken } from '@/lib/auth';
import { createPendingOperator, checkOperatorApproved as checkOperatorApproval } from '@/lib/contactsService';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'operator' | null;
export type MfaStatus = 'checking' | 'not_authenticated' | 'enrollment_required' | 'challenge_required' | 'verified';

interface AuthContextValue {
  user: User | null;
  role: UserRole;
  mfaStatus: MfaStatus;
  loading: boolean;
  isApproved: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMfaStatus: () => Promise<MfaStatus>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractRole(user: User | null): UserRole {
  if (!user) return null;
  // Hardcoded admin for owner email
  if (user.email === 'kim@mammajumboshrimp.com') return 'admin';
  const fromApp = (user.app_metadata?.role as string) ?? null;
  if (fromApp === 'admin' || fromApp === 'operator') return fromApp;
  return 'operator';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>('checking');
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(true);

  const refreshMfaStatus = async (): Promise<MfaStatus> => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      setMfaStatus('not_authenticated');
      return 'not_authenticated';
    }

    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const verifiedTotp = factors.data.totp.filter((factor) => factor.status === 'verified');
    if (!verifiedTotp.length) {
      setMfaStatus('enrollment_required');
      return 'enrollment_required';
    }

    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    const next = assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2'
      ? 'challenge_required'
      : 'verified';
    setMfaStatus(next);
    return next;
  };

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
        await refreshMfaStatus();
      } else {
        setMfaStatus('not_authenticated');
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
        await refreshMfaStatus();
      } else {
        setMfaStatus('not_authenticated');
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
    await refreshMfaStatus();
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.session?.access_token) {
      setAccessToken(data.session.access_token);
      try {
        await createPendingOperator(email);
      } catch (err) {
        await supabase.auth.signOut();
        throw new Error((err as Error).message || "Registrazione creata, ma richiesta approvazione non salvata. Contatta l'amministratore.");
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMfaStatus('not_authenticated');
  };

  return (
    <AuthContext.Provider value={{ user, role, mfaStatus, loading, isApproved, signIn, signUp, signOut, refreshMfaStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
