import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  </BrowserRouter>,
);
