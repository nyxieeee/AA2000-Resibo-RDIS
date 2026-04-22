const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.5:3001/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('aa2000-auth-token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}
