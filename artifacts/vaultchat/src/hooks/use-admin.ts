import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

export interface AdminUser {
  id: number;
  username: string;
  createdAt: number;
  isAdmin: boolean;
  isDisabled: boolean;
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
  };
  rooms: AdminUserDetailRoom[];
  roomMessages: AdminRoomMessage[];
  dms: AdminDm[];
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

export function useDisableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/admin/users/${id}/disable`, { method: "POST" }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function useEnableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/admin/users/${id}/enable`, { method: "POST" }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteAdminMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/admin/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteAdminDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/admin/dms/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
