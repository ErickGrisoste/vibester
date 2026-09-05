
const AUTH_URL = import.meta.env.VITE_AUTH_URL || '/api/auth';
const EVENT_URL = import.meta.env.VITE_EVENT_URL || '/api/events';
const ESTABLISHMENT_URL = import.meta.env.VITE_ESTABLISHMENT_URL || '/api/establishment';

export const URLS = { AUTH_URL, EVENT_URL, ESTABLISHMENT_URL };

function getToken(): string | null {
  return localStorage.getItem('vib_token');
}

type FetchOptions = RequestInit & { auth?: boolean };

async function request<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { auth = false, headers = {}, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers: finalHeaders, ...rest });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      const extracted = body?.message ?? body?.error;
      if (extracted) {
        errorMessage = typeof extracted === 'object' ? JSON.stringify(extracted) : String(extracted);
      }
    } catch {
    }
    throw new Error(`${errorMessage} (${res.status})`);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, auth = false) => request<T>(url, { method: 'GET', auth }),
  post: <T>(url: string, body: unknown, auth = false) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body), auth }),
  patch: <T>(url: string, body: unknown, auth = false) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body), auth }),
  delete: <T>(url: string, body?: unknown, auth = false) =>
    request<T>(url, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined, auth }),
};
