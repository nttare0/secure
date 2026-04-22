import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export interface MessageAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface Message {
  id: number;
  userId: number;
  username: string;
  content: string;
  attachment: MessageAttachment | null;
  createdAt: string;
}

export function useMessages(roomId?: number) {
  return useQuery({
    queryKey: ['rooms', roomId, 'messages'],
    queryFn: () => fetchApi<Message[]>(`/rooms/${roomId}/messages?limit=50`),
    enabled: !!roomId,
    refetchInterval: 2000, // Poll every 2 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, content, file }: { roomId: number; content?: string; file?: File }) => {
      const formData = new FormData();
      if (content) formData.append('content', content);
      if (file) formData.append('file', file);

      return fetchApi<Message>(`/rooms/${roomId}/messages`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (newMessage, variables) => {
      // Optimistically update the messages list
      queryClient.setQueryData<Message[]>(['rooms', variables.roomId, 'messages'], (old) => {
        if (!old) return [newMessage];
        // Ensure we don't duplicate messages
        if (old.some(m => m.id === newMessage.id)) return old;
        return [newMessage, ...old].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    },
  });
}
