import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn('Missing Supabase env vars.');
}

export const supabase = createClient(url ?? '', anonKey ?? '');

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentEmail(): string | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return (payload.email as string) ?? null;
  } catch {
    return null;
  }
}

export function getCurrentRoleFromToken(): string | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return ((payload.app_metadata as Record<string, unknown>)?.role ?? null) as string | null;
  } catch {
    return null;
  }
}

export function getPasswordRecoveryRedirectPath(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.location.pathname === '/reset-password') return null;

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  const canUsePkceCode = window.location.pathname === '/' || window.location.pathname === '/login';
  const isRecovery =
    hashParams.get('type') === 'recovery' ||
    searchParams.get('type') === 'recovery' ||
    (canUsePkceCode && searchParams.has('code'));

  if (!isRecovery) return null;
  return `/reset-password${window.location.search}${window.location.hash}`;
}