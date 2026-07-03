import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashParsed, setHashParsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Supabase puo' reindirizzare con #access_token=...&type=recovery oppure con ?code=... in flow PKCE.
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(window.location.search);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        const code = searchParams.get('code');

        if (accessToken && hashType === 'recovery') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session?.user) {
            throw new Error('Link non valido o scaduto. Richiedi un nuovo reset password.');
          }
        }

        if (cancelled) return;
        window.history.replaceState(null, '', '/reset-password');
        setHashParsed(true);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || 'Sessione non valida. Richiedi un nuovo reset password.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setSuccess(true);
      // Dopo 3 secondi reindirizza al login
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      setError((err as Error).message || 'Errore durante l\'aggiornamento della password.');
    } finally {
      setLoading(false);
    }
  };

  if (error && !hashParsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm bg-card border rounded-xl shadow-sm p-6 space-y-4">
          <h1 className="text-2xl font-bold text-center">Errore</h1>
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Torna al login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm bg-card border rounded-xl shadow-sm p-6 space-y-4">
          <h1 className="text-2xl font-bold text-center">Password aggiornata</h1>
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-center">
            La tua password è stata aggiornata con successo. Verrai reindirizzato al login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm bg-card border rounded-xl shadow-sm p-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Reset Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Inserisci la tua nuova password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nuova password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Conferma password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !hashParsed}>
            {loading ? 'Attendere...' : 'Aggiorna password'}
          </Button>
        </form>
      </div>
    </div>
  );
}