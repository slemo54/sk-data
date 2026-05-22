import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck } from 'lucide-react';

function onlyCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export default function MfaGate() {
  const { mfaStatus, refreshMfaStatus, signOut, user } = useAuth();
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(() => (
    mfaStatus === 'enrollment_required'
      ? 'Configura autenticazione a due fattori'
      : 'Inserisci codice Google Authenticator'
  ), [mfaStatus]);

  useEffect(() => {
    if (mfaStatus !== 'enrollment_required' || factorId) return;
    let cancelled = false;

    void (async () => {
      setError('');
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'SK Database',
      });
      if (cancelled) return;
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();

    return () => {
      cancelled = true;
    };
  }, [factorId, mfaStatus]);

  const getVerifiedFactorId = async (): Promise<string> => {
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const totp = factors.data.totp.find((factor) => factor.status === 'verified');
    if (!totp) throw new Error('Nessun fattore Google Authenticator trovato.');
    return totp.id;
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const targetFactorId = mfaStatus === 'enrollment_required' ? factorId : await getVerifiedFactorId();
      if (!targetFactorId) throw new Error('Fattore MFA non pronto.');

      const challenge = await supabase.auth.mfa.challenge({ factorId: targetFactorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: targetFactorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;

      await refreshMfaStatus();
      toast.success('Autenticazione a due fattori verificata');
    } catch (err) {
      setError((err as Error).message || 'Codice non valido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-sm p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email}
          </p>
        </div>

        {mfaStatus === 'enrollment_required' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scansiona il QR con Google Authenticator, poi inserisci il codice a 6 cifre.
            </p>
            {qrCode && (
              <div className="rounded-lg border bg-white p-3 flex justify-center">
                <img src={qrCode} alt="QR code Google Authenticator" className="h-44 w-44" />
              </div>
            )}
            {secret && (
              <div className="rounded-md bg-muted px-3 py-2 text-xs break-all">
                Secret manuale: <span className="font-mono">{secret}</span>
              </div>
            )}
          </div>
        )}

        {mfaStatus === 'challenge_required' && (
          <p className="text-sm text-muted-foreground">
            Apri Google Authenticator e inserisci il codice generato per SK Database.
          </p>
        )}

        <form onSubmit={handleVerify} className="space-y-3">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Codice a 6 cifre"
            value={code}
            onChange={(event) => setCode(onlyCode(event.target.value))}
            required
            minLength={6}
            className="h-11 text-center text-lg tracking-[0.35em]"
          />
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? 'Verifica...' : 'Verifica codice'}
          </Button>
        </form>

        <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
          Esci
        </Button>
      </div>
    </div>
  );
}
