import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/avatar";
import { WALLPAPERS, wallpaperUrl } from "@/lib/wallpapers";
import { AVATAR_PRESETS } from "@/lib/avatars";
import { ANIME_AVATARS, animeAvatarUrl } from "@/lib/anime-avatars";
import {
  useUpdateSettings,
  useUploadAvatar,
  useChangePassword,
} from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import {
  Check,
  Loader2,
  ImageOff,
  Upload,
  Sparkles,
  Smile,
  Image as ImageIcon,
  KeyRound,
  Palette,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AvatarKind = "initials" | "preset" | "anime" | "image";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { data: user } = useAuth();
  const update = useUpdateSettings();
  const uploadAvatar = useUploadAvatar();
  const changePassword = useChangePassword();
  const { toast } = useToast();

  const [wallpaperId, setWallpaperId] = useState<string | null>(user?.wallpaperId ?? null);
  const [avatarKind, setAvatarKind] = useState<AvatarKind>(
    (user?.avatar?.kind as AvatarKind) ?? "initials",
  );
  const [avatarValue, setAvatarValue] = useState<string | null>(user?.avatar?.value ?? null);

  // Password change form state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setWallpaperId(user?.wallpaperId ?? null);
      setAvatarKind((user?.avatar?.kind as AvatarKind) ?? "initials");
      setAvatarValue(user?.avatar?.value ?? null);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
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
          toast({
            title: "Couldn't update wallpaper",
            description: e.message,
            variant: "destructive",
          }),
      },
    );
  };

  const saveAvatar = (
    body:
      | { kind: "initials" }
      | { kind: "preset"; id: string }
      | { kind: "anime"; id: string }
      | { kind: "image"; url: string },
  ) => {
    setAvatarKind(body.kind);
    setAvatarValue(
      body.kind === "preset" || body.kind === "anime"
        ? body.id
        : body.kind === "image"
          ? body.url
          : null,
    );
    update.mutate(
      { avatar: body },
      {
        onSuccess: () => toast({ title: "Profile picture updated" }),
        onError: (e: any) =>
          toast({
            title: "Couldn't update avatar",
            description: e.message,
            variant: "destructive",
          }),
      },
    );
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.type)) {
      toast({
        title: "Unsupported file",
        description: "Pick a PNG, JPEG, WebP or GIF image.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Maximum size is 4 MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    uploadAvatar.mutate(file, {
      onSuccess: (u) => {
        setAvatarKind("image");
        setAvatarValue(u.avatar.value);
        toast({ title: "Profile picture uploaded" });
      },
      onError: (err: any) =>
        toast({
          title: "Upload failed",
          description: err.message,
          variant: "destructive",
        }),
      onSettled: () => {
        if (e.target) e.target.value = "";
      },
    });
  };

  const onSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast({
        title: "Passwords don't match",
        description: "Make sure the new password and confirmation are identical.",
        variant: "destructive",
      });
      return;
    }
    changePassword.mutate(
      { currentPassword: currentPwd, newPassword: newPwd },
      {
        onSuccess: () => {
          toast({
            title: "Password changed",
            description: "Use your new password the next time you sign in.",
          });
          setCurrentPwd("");
          setNewPwd("");
          setConfirmPwd("");
        },
        onError: (err: any) =>
          toast({
            title: "Could not change password",
            description: err.message,
            variant: "destructive",
          }),
      },
    );
  };

  if (!user) return null;

  const currentAvatarSpec = { kind: avatarKind, value: avatarValue };
  const accountAge = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Personalize your VaultChat experience.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="profile" className="gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Profile
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Wallpaper
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Account
              </TabsTrigger>
            </TabsList>
          </div>

          {/* PROFILE TAB */}
          <TabsContent
            value="profile"
            className="flex-1 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          >
            <div className="space-y-6">
              {/* Header card with current avatar */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                <Avatar
                  username={user.username}
                  avatar={currentAvatarSpec}
                  size="xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-lg truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Choose a profile picture below — it appears next to your name everywhere.
                  </p>
                </div>
                {(update.isPending || uploadAvatar.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>

              {/* Upload custom */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Upload your own</h3>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileChange}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    aria-label="Upload custom profile picture"
                  />
                  <Button
                    type="button"
                    onClick={onPickFile}
                    disabled={uploadAvatar.isPending}
                    variant="outline"
                  >
                    {uploadAvatar.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload from your device
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF — up to 4 MB</p>
                </div>
                {avatarKind === "image" && avatarValue && (
                  <div className="mt-3 flex items-center gap-3 p-3 rounded-md border border-border/50 bg-muted/20">
                    <img
                      src={avatarValue}
                      alt="Your custom avatar"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Custom photo</p>
                      <p className="text-xs text-muted-foreground">
                        This is what others see next to your messages.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => saveAvatar({ kind: "initials" })}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </section>

              {/* Anime avatars */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Anime characters</h3>
                  <span className="text-xs text-muted-foreground">
                    Naruto · Dragon Ball · Demon Slayer
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                  {ANIME_AVATARS.map((a) => {
                    const active = avatarKind === "anime" && avatarValue === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => saveAvatar({ kind: "anime", id: a.id })}
                        className={cn(
                          "group relative rounded-xl overflow-hidden border-2 transition-all aspect-square bg-muted",
                          active
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50",
                        )}
                        title={`${a.name} (${a.source})`}
                        aria-label={`${a.name} from ${a.source}`}
                      >
                        <img
                          src={animeAvatarUrl(a.id)!}
                          alt={a.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5">
                          <p className="text-[11px] font-medium text-white truncate text-left">
                            {a.name}
                          </p>
                          <p className="text-[9px] text-white/70 truncate text-left">{a.source}</p>
                        </div>
                        {active && (
                          <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Emoji presets */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Smile className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Emoji presets</h3>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-3">
                  <button
                    type="button"
                    onClick={() => saveAvatar({ kind: "initials" })}
                    className={cn(
                      "relative rounded-full transition-all p-1",
                      avatarKind === "initials"
                        ? "ring-2 ring-primary"
                        : "hover:ring-2 hover:ring-primary/30",
                    )}
                    aria-label="Use initials"
                    title="Initials"
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
                        onClick={() => saveAvatar({ kind: "preset", id: p.id })}
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
              </section>
            </div>
          </TabsContent>

          {/* WALLPAPER TAB */}
          <TabsContent
            value="appearance"
            className="flex-1 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Pick a wallpaper for your chats — it shows behind every message.
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

          {/* ACCOUNT TAB */}
          <TabsContent
            value="account"
            className="flex-1 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          >
            <div className="space-y-6 max-w-md">
              <section>
                <h3 className="text-sm font-semibold mb-2">Account info</h3>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-medium">{user.username}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account ID</span>
                    <span className="font-mono text-xs">#{user.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{user.isAdmin ? "Administrator" : "Member"}</span>
                  </div>
                  {accountAge && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Joined</span>
                      <span className="font-medium">{accountAge}</span>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Change password</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Pick a strong password — at least 6 characters.
                </p>
                <form onSubmit={onSubmitPassword} className="space-y-3">
                  <div>
                    <Label htmlFor="current-pwd">Current password</Label>
                    <Input
                      id="current-pwd"
                      type="password"
                      autoComplete="current-password"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-pwd">New password</Label>
                    <Input
                      id="new-pwd"
                      type="password"
                      autoComplete="new-password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="mt-1.5"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-pwd">Confirm new password</Label>
                    <Input
                      id="confirm-pwd"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      className="mt-1.5"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      changePassword.isPending ||
                      !currentPwd ||
                      !newPwd ||
                      newPwd.length < 6 ||
                      newPwd !== confirmPwd
                    }
                  >
                    {changePassword.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Update password
                  </Button>
                </form>
              </section>

              {/* Hidden filler so settings don't visually jump */}
              <div className="opacity-0 pointer-events-none">
                <ImageIcon className="h-4 w-4" />
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
