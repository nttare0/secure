import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, API_BASE } from "@/lib/api";

export interface UpdateSettingsBody {
  wallpaperId?: string | null;
  avatar?:
    | { kind: "initials" }
    | { kind: "preset"; id: string }
    | { kind: "anime"; id: string }
    | { kind: "image"; url: string };
}

export interface UpdatedUser {
  id: number;
  username: string;
  wallpaperId: string | null;
  avatar: { kind: string; value: string | null };
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsBody) =>
      fetchApi<UpdatedUser>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      qc.invalidateQueries({ queryKey: ["dms"] });
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        let msg = "Could not upload avatar";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      return (await res.json()) as UpdatedUser;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      qc.invalidateQueries({ queryKey: ["dms"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      fetchApi<{ ok: boolean }>("/users/me/password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
