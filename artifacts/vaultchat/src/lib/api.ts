// In production, set VITE_API_URL to your backend origin (e.g. https://api.yourdomain.com)
// In development the Vite proxy handles /api → localhost:8000
const apiOrigin = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
  : "";

export const API_BASE = apiOrigin
  ? `${apiOrigin}/api`
  : `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: options.body instanceof FormData ? options.headers : {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = 'An error occurred';
    let data: any = null;
    try {
      data = await res.json();
      if (data && typeof data.error === 'string') errorMsg = data.error;
    } catch (e) {
      // Ignored
    }
    throw new ApiError(errorMsg, res.status, data);
  }

  // Handle empty responses
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T;
  }

  try {
    return await res.json();
  } catch (e) {
    return {} as T;
  }
}
