import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function onlyCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

function requiresAal2(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('aal2') || normalized.includes('mfa');
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
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

        const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!assurance.error && assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') {
          setMfaRequired(true);
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

  const getVerifiedFactorId = async (): Promise<string> => {
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const totp = factors.data.totp.find((factor) => factor.status === 'verified');
    if (!totp) throw new Error('Nessun fattore Google Authenticator verificato per questo account.');
    return totp.id;
  };

  const verifyMfa = async () => {
    if (mfaCode.length !== 6) {
      throw new Error('Inserisci il codice Google Authenticator a 6 cifre.');
    }

    const factorId = await getVerifiedFactorId();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) throw challenge.error;

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: mfaCode,
    });
    if (verify.error) throw verify.error;
  };

  const updatePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    setSuccess(true);
    // Dopo 3 secondi reindirizza al login
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 3000);
  };

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
      if (mfaRequired) {
        await verifyMfa();
      }
      await updatePassword();
    } catch (err) {
      const message = (err as Error).message || 'Errore durante l\'aggiornamento della password.';
      if (!mfaRequired && requiresAal2(message)) {
        setMfaRequired(true);
        setError('Per cambiare la password devi inserire anche il codice Google Authenticator.');
      } else {
        setError(message);
      }
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
            La tua password e' stata aggiornata con successo. Verrai reindirizzato al login...
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

          {mfaRequired && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div>
                <label className="text-sm font-medium">Codice Google Authenticator</label>
                <p className="text-xs text-muted-foreground">
                  Supabase richiede una verifica AAL2 per cambiare password quando MFA e' attivo.
                </p>
              </div>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Codice a 6 cifre"
                value={mfaCode}
                onChange={(event) => setMfaCode(onlyCode(event.target.value))}
                required={mfaRequired}
                minLength={6}
                className="h-11 text-center text-lg tracking-[0.35em]"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !hashParsed || (mfaRequired && mfaCode.length !== 6)}>
            {loading ? 'Attendere...' : mfaRequired ? 'Verifica e aggiorna password' : 'Aggiorna password'}
          </Button>
        </form>
      </div>
    </div>
  );
}