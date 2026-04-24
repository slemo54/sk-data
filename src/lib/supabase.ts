const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn('Supabase env not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    apikey: anonKey ?? '',
    Authorization: `Bearer ${anonKey ?? ''}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function sbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getSupabaseRestHeaders(extra?: Record<string, string>): HeadersInit {
  return buildHeaders(extra);
}

export function getSupabaseUrl(): string {
  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL');
  }
  return url;
}
