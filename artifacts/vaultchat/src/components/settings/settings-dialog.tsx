import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { WALLPAPERS, wallpaperUrl } from "@/lib/wallpapers";
import { AVATAR_PRESETS } from "@/lib/avatars";
import { useUpdateSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { Check, Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { data: user } = useAuth();
  const update = useUpdateSettings();
  const { toast } = useToast();

  const [wallpaperId, setWallpaperId] = useState<string | null>(user?.wallpaperId ?? null);
  const [avatarKind, setAvatarKind] = useState<"initials" | "preset">(
    (user?.avatar?.kind as "initials" | "preset") ?? "initials",
  );
  const [avatarValue, setAvatarValue] = useState<string | null>(user?.avatar?.value ?? null);

  useEffect(() => {
    if (open) {
      setWallpaperId(user?.wallpaperId ?? null);
      setAvatarKind((user?.avatar?.kind as "initials" | "preset") ?? "initials");
      setAvatarValue(user?.avatar?.value ?? null);
    }
  }, [open, user]);

  const saveWallpaper = (id: string | null) => {
    setWallpaperId(id);
    update.mutate(
      { wallpaperId: id },
      {
        onSuccess: () =>
          toast({
            title: id ? "Wallpaper applied" : "Wallpaper cleared",
            description: id ? "Your chat now has a fresh look." : "Default background restored.",
          }),
        onError: (e: any) =>
          toast({ title: "Couldn't update wallpaper", description: e.message, variant: "destructive" }),
      },
    );
  };

  const saveAvatar = (kind: "initials" | "preset", value: string | null) => {
    setAvatarKind(kind);
    setAvatarValue(value);
    const body = kind === "preset" && value
      ? { avatar: { kind: "preset" as const, id: value } }
      : { avatar: { kind: "initials" as const } };
    update.mutate(body, {
      onSuccess: () => toast({ title: "Profile picture updated" }),
      onError: (e: any) =>
        toast({
          title: "Couldn't update avatar",
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Personalize your VaultChat experience.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="grid w-full grid-cols-2 max-w-sm">
              <TabsTrigger value="appearance">Wallpaper</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="appearance"
            className="flex-1 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Pick a wallpaper for your chats. Looks great on phone or desktop.
                </p>
                {update.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => saveWallpaper(null)}
                  className={cn(
                    "relative aspect-[3/4] rounded-lg border-2 overflow-hidden transition-all",
                    "bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center",
                    wallpaperId === null
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50",
                  )}
                  aria-label="No wallpaper"
                >
                  <ImageOff className="h-6 w-6 text-muted-foreground" />
                  <span className="absolute bottom-1 left-1 right-1 text-[10px] text-center text-muted-foreground bg-background/80 rounded px-1">
                    None
                  </span>
                  {wallpaperId === null && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
                {WALLPAPERS.map((w) => {
                  const active = wallpaperId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => saveWallpaper(w.id)}
                      className={cn(
                        "relative aspect-[3/4] rounded-lg border-2 overflow-hidden transition-all group",
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50",
                      )}
                      aria-label={w.name}
                    >
                      <img
                        src={wallpaperUrl(w.id)!}
                        alt={w.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1 left-1 right-1 text-[10px] text-center text-white bg-black/60 rounded px-1 truncate">
                        {w.name}
                      </span>
                      {active && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="profile"
            className="flex-1 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          >
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                <Avatar
                  username={user.username}
                  avatar={{ kind: avatarKind, value: avatarValue }}
                  size="xl"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-lg truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Pick a profile picture below — it appears next to your name everywhere.
                  </p>
                </div>
                {update.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto shrink-0" />
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-3">Choose a preset</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  <button
                    type="button"
                    onClick={() => saveAvatar("initials", null)}
                    className={cn(
                      "relative rounded-full transition-all p-1",
                      avatarKind === "initials"
                        ? "ring-2 ring-primary"
                        : "hover:ring-2 hover:ring-primary/30",
                    )}
                    aria-label="Use initials"
                  >
                    <Avatar
                      username={user.username}
                      avatar={{ kind: "initials", value: null }}
                      size="lg"
                    />
                    {avatarKind === "initials" && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                  {AVATAR_PRESETS.map((p) => {
                    const active = avatarKind === "preset" && avatarValue === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => saveAvatar("preset", p.id)}
                        className={cn(
                          "relative rounded-full transition-all p-1",
                          active
                            ? "ring-2 ring-primary"
                            : "hover:ring-2 hover:ring-primary/30",
                        )}
                        aria-label={p.label}
                        title={p.label}
                      >
                        <Avatar
                          username={user.username}
                          avatar={{ kind: "preset", value: p.id }}
                          size="lg"
                        />
                        {active && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-3 border-t border-border/50 shrink-0 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
