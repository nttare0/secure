import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

export interface AdminUser {
  id: number;
  username: string;
  createdAt: number;
  isAdmin: boolean;
  isDisabled: boolean;
  lastSeen: number | null;
  online?: boolean;
  avatar?: { kind: string; value: string | null };
  roomMessageCount: number;
  dmCount: number;
  roomsOwned: number;
}

export interface AdminUserDetailRoom {
  id: number;
  name: string;
  code: string;
  createdAt: number;
  isOwner: boolean;
}

export interface AdminRoomMessage {
  id: number;
  content: string | null;
  createdAt: number;
  attachmentName: string | null;
  roomId: number;
  roomName: string;
}

export interface AdminDm {
  id: number;
  content: string | null;
  createdAt: number;
  attachmentName: string | null;
  senderId: number;
  senderUsername: string;
  recipientId: number;
  recipientUsername: string;
}

export interface AdminUserDetail {
  user: {
    id: number;
    username: string;
    createdAt: number;
    isAdmin: boolean;
    isDisabled: boolean;
    lastSeen: number | null;
    online?: boolean;
    avatar?: { kind: string; value: string | null };
    wallpaperId?: string | null;
  };
  rooms: AdminUserDetailRoom[];
  roomMessages: AdminRoomMessage[];
  dms: AdminDm[];
}

export interface AdminStats {
  userCount: number;
  adminCount: number;
  disabledCount: number;
  roomCount: number;
  messageCount: number;
  dmCount: number;
  attachmentCount: number;
  activeRecently: number;
  onlineUsers: number;
  newUsers24h: number;
  roomMessages24h: number;
  dms24h: number;
}

export interface AdminRoom {
  id: number;
  name: string;
  code: string;
  createdAt: number;
  ownerId: number;
  ownerUsername: string;
  memberCount: number;
  messageCount: number;
  lastMessageAt: number | null;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "users"] });
  qc.invalidateQueries({ queryKey: ["admin", "stats"] });
  qc.invalidateQueries({ queryKey: ["admin", "rooms"] });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchApi<AdminStats>("/admin/stats"),
    refetchInterval: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchApi<{ users: AdminUser[] }>("/admin/users").then((r) => r.users),
  });
}

export function useAdminUserDetail(userId: number | undefined) {
  return useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: () => fetchApi<AdminUserDetail>(`/admin/users/${userId}`),
    enabled: typeof userId === "number",
  });
}

export function useAdminRooms() {
  return useQuery({
    queryKey: ["admin", "rooms"],
    queryFn: () => fetchApi<{ rooms: AdminRoom[] }>("/admin/rooms").then((r) => r.rooms),
  });
}

export function useDisableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/users/${id}/disable`, { method: "POST" }),
    onSuccess: (_d, id) => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function useEnableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/users/${id}/enable`, { method: "POST" }),
    onSuccess: (_d, id) => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function usePromoteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/users/${id}/promote`, { method: "POST" }),
    onSuccess: (_d, id) => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function useDemoteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/users/${id}/demote`, { method: "POST" }),
    onSuccess: (_d, id) => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      fetchApi(`/admin/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAdminMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAdminDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/dms/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAdminRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/rooms/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}
