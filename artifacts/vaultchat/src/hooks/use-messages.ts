import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export interface MessageAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ReplyPreview {
  id: number;
  username: string | null;
  content: string | null;
  attachmentName: string | null;
}

export interface CallEvent {
  kind: "audio" | "video";
  duration: number | null;
  participants: string[];
}

export interface Message {
  id: number;
  userId: number;
  username: string;
  content: string;
  attachment: MessageAttachment | null;
  createdAt: string;
  editedAt: number | null;
  forwardedFrom: string | null;
  replyTo: ReplyPreview | null;
  messageType?: "message" | "call";
  callEvent?: CallEvent | null;
}

export function useMessages(roomId?: number) {
  return useQuery({
    queryKey: ['rooms', roomId, 'messages'],
    queryFn: () => fetchApi<Message[]>(`/rooms/${roomId}/messages?limit=50`),
    enabled: !!roomId,
    refetchInterval: 2000,
  });
}

export interface SendMessageVars {
  roomId: number;
  content?: string;
  file?: File;
  replyToId?: number;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, content, file, replyToId }: SendMessageVars) => {
      const formData = new FormData();
      if (content) formData.append('content', content);
      if (file) formData.append('file', file);
      if (replyToId) formData.append('replyToId', String(replyToId));

      return fetchApi<Message>(`/rooms/${roomId}/messages`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (newMessage, variables) => {
      queryClient.setQueryData<Message[]>(['rooms', variables.roomId, 'messages'], (old) => {
        if (!old) return [newMessage];
        if (old.some(m => m.id === newMessage.id)) return old;
        return [newMessage, ...old].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, messageId, content }: { roomId: number; messageId: number; content: string }) =>
      fetchApi<Message>(`/rooms/${roomId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<Message[]>(['rooms', variables.roomId, 'messages'], (old) =>
        old?.map((m) => (m.id === updated.id ? updated : m)),
      );
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, messageId }: { roomId: number; messageId: number }) =>
      fetchApi<{ ok: boolean }>(`/rooms/${roomId}/messages/${messageId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<Message[]>(['rooms', variables.roomId, 'messages'], (old) =>
        old?.filter((m) => m.id !== variables.messageId),
      );
    },
  });
}

export interface ForwardTarget {
  type: 'room' | 'dm';
  id: number;
}

export function useForwardMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      source: { type: 'room' | 'dm'; messageId: number };
      targets: ForwardTarget[];
    }) =>
      fetchApi<{ delivered: Array<{ type: string; id: number; ok: boolean; error?: string }> }>(
        '/messages/forward',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dms'] });
    },
  });
}
