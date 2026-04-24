import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import Login from '@/pages/Login';
import DashboardCapo from '@/pages/DashboardCapo';
import OperatorePage from '@/pages/OperatorePage';

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: 'admin' | 'operator';
}) {
  const { user, role, loading } = useAuth();

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
            <DashboardCapo />
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
    </Routes>
  );
}
