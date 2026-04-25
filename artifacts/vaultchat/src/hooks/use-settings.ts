import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export interface UpdateSettingsBody {
  wallpaperId?: string | null;
  avatar?: { kind: "initials" } | { kind: "preset"; id: string };
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsBody) =>
      fetchApi<{ id: number; wallpaperId: string | null; avatar: { kind: string; value: string | null } }>(
        "/users/me",
        { method: "PATCH", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      qc.invalidateQueries({ queryKey: ["dms"] });
    },
  });
}
