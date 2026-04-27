import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type UserRole = 'admin' | 'operator' | null;

const CAPO_EMAIL = 'kim@mammajumboshrimp.com';

function extractRole(user: User | null): UserRole {
  if (!user) return null;
  if (user.email === CAPO_EMAIL) return 'admin';
  const fromApp = (user.app_metadata?.role as string) ?? null;
  const fromUser = (user.user_metadata?.role as string) ?? null;
  const r = fromApp || fromUser;
  if (r === 'admin' || r === 'operator') return r;
  return 'operator';
}

function navigateByRole(role: UserRole, navigate: ReturnType<typeof useNavigate>) {
  if (role === 'admin') {
    navigate('/', { replace: true });
  } else if (role === 'operator') {
    navigate('/operatore', { replace: true });
  }
}

export default function Login() {
  const { signIn, signUp, user, role } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [capoPassword, setCapoPassword] = useState('');
  const [capoError, setCapoError] = useState('');
  const [capoLoading, setCapoLoading] = useState(false);

  useEffect(() => {
    if (user && role) {
      navigateByRole(role, navigate);
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMode('login');
        setError('Registrazione completata. Controlla la tua email per la conferma, poi effettua il login.');
        setLoading(false);
        return;
      }
      // Redirect immediato dopo login riuscito
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      const r = extractRole(u);
      navigateByRole(r, navigate);
    } catch (err) {
      setError((err as Error).message || 'Errore di autenticazione');
    } finally {
      setLoading(false);
    }
  };

  const handleCapoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCapoError('');
    setCapoLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: CAPO_EMAIL,
        password: capoPassword,
      });
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (err) {
      setCapoError((err as Error).message || 'Password errata');
    } finally {
      setCapoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm bg-card border rounded-xl shadow-sm p-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            SK <span className="text-muted-foreground font-semibold">DATABASE</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? 'Accedi al tuo account' : 'Registra nuovo operatore'}
          </p>
        </div>

        {/* Form Operatore */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'login' ? 'register' : 'login'));
              setError('');
            }}
            className="text-sm text-primary hover:underline"
          >
            {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">oppure</span>
          </div>
        </div>

        {/* Form Capo */}
        <form onSubmit={handleCapoLogin} className="space-y-3">
          <div className="text-center">
            <p className="text-sm font-medium">Accesso Capo</p>
            <p className="text-xs text-muted-foreground">Inserisci solo la password</p>
          </div>
          <Input
            type="password"
            value={capoPassword}
            onChange={(e) => setCapoPassword(e.target.value)}
            placeholder="Password capo"
            required
          />
          {capoError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {capoError}
            </div>
          )}
          <Button type="submit" variant="outline" className="w-full" disabled={capoLoading}>
            {capoLoading ? 'Attendere...' : 'Entra come Capo'}
          </Button>
        </form>
      </div>
    </div>
  );
}
