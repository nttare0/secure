import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export interface Room {
  id: number;
  name: string;
  code: string;
  isOwner: boolean;
  memberCount: number;
  lastMessageAt: string | null;
}

export interface RoomMember {
  id: number;
  username: string;
}

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => fetchApi<Room[]>('/rooms'),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => 
      fetchApi<Room>('/rooms', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useJoinRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string }) => 
      fetchApi<Room>('/rooms/join', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => 
      fetchApi<{ ok: boolean }>(`/rooms/${id}/leave`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => 
      fetchApi<{ ok: boolean }>(`/rooms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useRoomMembers(roomId?: number) {
  return useQuery({
    queryKey: ['rooms', roomId, 'members'],
    queryFn: () => fetchApi<RoomMember[]>(`/rooms/${roomId}/members`),
    enabled: !!roomId,
  });
}
