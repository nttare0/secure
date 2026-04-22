export const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

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
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      // Ignored
    }
    throw new Error(errorMsg);
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
