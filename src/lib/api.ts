const DEFAULT_API_BASE_URL = 'https://desktop-0iik0rk.tail78436b.ts.net';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
export const API_URL = (import.meta.env.DEV || (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('capacitor'))) ? '/api' : API_BASE_URL;

type ApiError = Error & { status?: number };

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('aa2000-auth-token');
  const apiKey = import.meta.env.VITE_API_KEY;

  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  // Only set Content-Type to application/json if it's not already set and body is not FormData
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const urlWithKey = apiKey 
    ? `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`
    : `${API_URL}${endpoint}`;

  const response = await fetch(urlWithKey, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: `Request failed (${response.status} ${response.statusText})` }));
    const apiError = new Error(error.error || error.message || `Request failed with status ${response.status}`) as ApiError;
    apiError.status = response.status;
    throw apiError;
  }

  return response.json();
}
