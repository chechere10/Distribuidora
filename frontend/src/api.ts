export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function removeToken(): void {
  localStorage.removeItem('token');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  
  post: <T>(path: string, body?: unknown): Promise<T> => 
    request<T>(path, { 
      method: 'POST', 
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}) 
    }),
  
  patch: <T>(path: string, body?: unknown): Promise<T> => 
    request<T>(path, { 
      method: 'PATCH', 
      body: JSON.stringify(body ?? {}) 
    }),
  
  put: <T>(path: string, body?: unknown): Promise<T> => 
    request<T>(path, { 
      method: 'PUT', 
      body: JSON.stringify(body ?? {}) 
    }),
  
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
  
  upload: async <T>(path: string, file: File, fieldName = 'file'): Promise<T> => {
    const formData = new FormData();
    formData.append(fieldName, file);
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  },
};


