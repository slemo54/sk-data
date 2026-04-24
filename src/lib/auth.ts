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
    return (
      (payload.app_metadata as Record<string, unknown>)?.role ??
      (payload.user_metadata as Record<string, unknown>)?.role ??
      null
    ) as string | null;
  } catch {
    return null;
  }
}
