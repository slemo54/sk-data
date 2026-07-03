import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { getPasswordRecoveryRedirectPath } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import MfaGate from '@/components/MfaGate';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import DashboardSK from '@/pages/DashboardCapo';
import OperatorePage from '@/pages/OperatorePage';

function PendingApproval() {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mx-auto">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold">Account in attesa di approvazione</h1>
        <p className="text-sm text-muted-foreground">
          L'account <strong>{user?.email}</strong> è stato registrato correttamente ma deve essere approvato dall'amministratore prima di poter accedere.
        </p>
        <p className="text-xs text-muted-foreground">
          Riceverai un'email quando il tuo account sarà approvato.
        </p>
        <Button onClick={() => void signOut()} variant="outline" className="w-full">
          Esci
        </Button>
      </div>
    </div>
  );
}

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: 'admin' | 'operator';
}) {
  const { user, role, mfaStatus, loading, isApproved, signOut } = useAuth();
  const recoveryPath = getPasswordRecoveryRedirectPath();

  if (recoveryPath) {
    return <Navigate to={recoveryPath} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se non approvato, mostra pagina attesa
  if (!isApproved && role !== 'admin') {
    return <PendingApproval />;
  }

  if (mfaStatus === 'checking' || mfaStatus === 'not_authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Verifica sicurezza...</div>
      </div>
    );
  }

  if (mfaStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md bg-card border rounded-xl shadow-sm p-8 text-center space-y-4">
          <h1 className="text-xl font-bold">Verifica sicurezza non riuscita</h1>
          <p className="text-sm text-muted-foreground">
            Non riesco a completare il controllo Google Authenticator. Esci e rifai l'accesso.
          </p>
          <Button onClick={() => void signOut()} variant="outline" className="w-full">
            Esci
          </Button>
        </div>
      </div>
    );
  }

  if (mfaStatus === 'enrollment_required' || mfaStatus === 'challenge_required') {
    return <MfaGate />;
  }

  if (allowedRole && role !== allowedRole) {
    if (role === 'admin') return <Navigate to="/" replace />;
    if (role === 'operator') return <Navigate to="/operatore" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRole="admin">
            <DashboardSK />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operatore"
        element={
          <ProtectedRoute allowedRole="operator">
            <OperatorePage />
          </ProtectedRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}