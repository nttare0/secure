import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export interface User {
  id: number;
  username: string;
  isAdmin?: boolean;
  avatar?: { kind: string; value: string | null };
  wallpaperId?: string | null;
  createdAt?: number;
}

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => fetchApi<{ user: User }>('/auth/me').then(res => res.user),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string; rememberMe?: boolean }) =>
      fetchApi<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string; acceptedTerms: boolean }) =>
      fetchApi<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    },
  });
}
