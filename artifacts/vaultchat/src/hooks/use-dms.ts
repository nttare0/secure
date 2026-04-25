import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import type { Message } from "./use-messages";

export interface DmConversation {
  userId: number;
  username: string;
  lastMessageAt: number | null;
  lastMessage: string | null;
  lastSeen: number | null;
}

export interface DmThread {
  peer: { id: number; username: string; lastSeen: number | null };
  messages: Message[];
}

export interface DmUser {
  id: number;
  username: string;
  lastSeen?: number | null;
}

export function useDms() {
  return useQuery({
    queryKey: ["dms"],
    queryFn: () => fetchApi<DmConversation[]>("/dms"),
    refetchInterval: 5000,
  });
}

export function useDmThread(userId?: number) {
  return useQuery({
    queryKey: ["dms", userId, "messages"],
    queryFn: () => fetchApi<DmThread>(`/dms/${userId}/messages?limit=50`),
    enabled: !!userId,
    refetchInterval: 2000,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["dms", "search", query],
    queryFn: () => fetchApi<DmUser[]>(`/dms/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });
}

export interface SendDmVars {
  userId: number;
  content?: string;
  file?: File;
  replyToId?: number;
}

export function useSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, content, file, replyToId }: SendDmVars) => {
      const formData = new FormData();
      if (content) formData.append("content", content);
      if (file) formData.append("file", file);
      if (replyToId) formData.append("replyToId", String(replyToId));
      return fetchApi<Message>(`/dms/${userId}/messages`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (newMessage, variables) => {
      queryClient.setQueryData<DmThread>(["dms", variables.userId, "messages"], (old) => {
        if (!old) return old;
        if (old.messages.some((m) => m.id === newMessage.id)) return old;
        return {
          ...old,
          messages: [newMessage, ...old.messages].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["dms"] });
    },
  });
}

export function useEditDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, messageId, content }: { userId: number; messageId: number; content: string }) =>
      fetchApi<Message>(`/dms/${userId}/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<DmThread>(["dms", variables.userId, "messages"], (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((m) => (m.id === updated.id ? updated : m)),
            }
          : old,
      );
    },
  });
}

export function useDeleteDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, messageId }: { userId: number; messageId: number }) =>
      fetchApi<{ ok: boolean }>(`/dms/${userId}/messages/${messageId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<DmThread>(["dms", variables.userId, "messages"], (old) =>
        old
          ? {
              ...old,
              messages: old.messages.filter((m) => m.id !== variables.messageId),
            }
          : old,
      );
    },
  });
}
