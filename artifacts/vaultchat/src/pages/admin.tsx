import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useAdminUsers,
  useAdminUserDetail,
  useAdminStats,
  useAdminRooms,
  useDisableUser,
  useEnableUser,
  usePromoteUser,
  useDemoteUser,
  useResetPassword,
  useDeleteUser,
  useDeleteAdminMessage,
  useDeleteAdminDm,
  useDeleteAdminRoom,
  type AdminUser,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Avatar } from "@/components/avatar";
import {
  Shield,
  ShieldCheck,
  Loader2,
  Search,
  Ban,
  CheckCircle2,
  Trash2,
  ArrowLeft,
  Hash,
  MessageSquare,
  X,
  Crown,
  AlertTriangle,
  Users as UsersIcon,
  Activity,
  Paperclip,
  KeyRound,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Circle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function Admin() {
  const { data: me, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !me) setLocation("/login");
  }, [isLoading, me, setLocation]);

  if (isLoading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!me.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4 border border-destructive/30">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-1">Access denied</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm">
          Only administrators can view this page.
        </p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to chat
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      <header className="h-14 sm:h-16 border-b border-border/50 bg-background/95 backdrop-blur flex items-center px-3 sm:px-6 gap-3 shrink-0">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Back to chat">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="h-9 w-9 sm:h-10 sm:w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
          <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-foreground leading-tight truncate">
            Admin console
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Stats, users, rooms, and moderation
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="hidden sm:inline">{me.username}</span>
        </div>
      </header>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border/50 px-3 sm:px-6 shrink-0">
          <TabsList className="h-11 bg-transparent gap-1">
            <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-muted">
              <LayoutDashboard className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 data-[state=active]:bg-muted">
              <UsersIcon className="h-3.5 w-3.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-1.5 data-[state=active]:bg-muted">
              <Hash className="h-3.5 w-3.5" /> Rooms
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="overview"
          className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden"
        >
          <OverviewPanel />
        </TabsContent>

        <TabsContent
          value="users"
          className="flex-1 m-0 min-h-0 overflow-hidden data-[state=inactive]:hidden"
        >
          <UsersPanel meId={me.id} toast={toast} />
        </TabsContent>

        <TabsContent
          value="rooms"
          className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden"
        >
          <RoomsPanel toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------- OVERVIEW -------------------------------- */

function OverviewPanel() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    sub?: string;
  }> = [
    {
      label: "Users",
      value: stats.userCount,
      icon: <UsersIcon className="h-5 w-5" />,
      accent: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400 border-sky-500/20",
      sub: `${stats.adminCount} admin · ${stats.disabledCount} disabled`,
    },
    {
      label: "Online now",
      value: stats.onlineUsers,
      icon: <Circle className="h-5 w-5 fill-current" />,
      accent:
        "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      sub: `${stats.activeRecently} active in last 5 min`,
    },
    {
      label: "Rooms",
      value: stats.roomCount,
      icon: <Hash className="h-5 w-5" />,
      accent:
        "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500/20",
    },
    {
      label: "Messages",
      value: stats.messageCount,
      icon: <MessageSquare className="h-5 w-5" />,
      accent:
        "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20",
      sub: `${stats.roomMessages24h} in last 24 h`,
    },
    {
      label: "Direct messages",
      value: stats.dmCount,
      icon: <MessageSquare className="h-5 w-5" />,
      accent:
        "from-pink-500/15 to-pink-500/5 text-pink-600 dark:text-pink-400 border-pink-500/20",
      sub: `${stats.dms24h} in last 24 h`,
    },
    {
      label: "Attachments",
      value: stats.attachmentCount,
      icon: <Paperclip className="h-5 w-5" />,
      accent:
        "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
    {
      label: "New users (24 h)",
      value: stats.newUsers24h,
      icon: <Activity className="h-5 w-5" />,
      accent:
        "from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400 border-teal-500/20",
    },
    {
      label: "Admins",
      value: stats.adminCount,
      icon: <Crown className="h-5 w-5" />,
      accent:
        "from-yellow-500/15 to-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Workspace overview</h2>
        <p className="text-sm text-muted-foreground">
          Live snapshot of your VaultChat — refreshes automatically every 30 seconds.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-xl border p-4 bg-gradient-to-br relative overflow-hidden",
              c.accent,
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                {c.label}
              </span>
              <span className="opacity-80">{c.icon}</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{c.value.toLocaleString()}</p>
            {c.sub && <p className="text-[11px] mt-1 opacity-70">{c.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------- USERS ---------------------------------- */

function UsersPanel({ meId, toast }: { meId: number; toast: ReturnType<typeof useToast>["toast"] }) {
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "admins" | "disabled">("all");

  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const detail = useAdminUserDetail(selectedId);
  const disableMut = useDisableUser();
  const enableMut = useEnableUser();
  const promoteMut = usePromoteUser();
  const demoteMut = useDemoteUser();
  const resetMut = useResetPassword();
  const deleteUserMut = useDeleteUser();
  const deleteMsgMut = useDeleteAdminMessage();
  const deleteDmMut = useDeleteAdminDm();

  const filtered = (users || [])
    .filter((u) => u.username.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((u) => {
      if (filter === "online") return u.online;
      if (filter === "admins") return u.isAdmin;
      if (filter === "disabled") return u.isDisabled;
      return true;
    });

  const runWithToast = async (label: string, fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast({ title: successMsg });
    } catch (err: any) {
      toast({ title: label + " failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDisable = (u: AdminUser) =>
    runWithToast("Disable", () => disableMut.mutateAsync(u.id), `${u.username} disabled`);
  const handleEnable = (u: AdminUser) =>
    runWithToast("Enable", () => enableMut.mutateAsync(u.id), `${u.username} re-enabled`);
  const handlePromote = (u: AdminUser) =>
    runWithToast("Promote", () => promoteMut.mutateAsync(u.id), `${u.username} is now an admin`);
  const handleDemote = (u: AdminUser) => {
    if (!confirm(`Remove admin role from ${u.username}?`)) return;
    runWithToast("Demote", () => demoteMut.mutateAsync(u.id), `${u.username} is no longer an admin`);
  };
  const handleResetPassword = async (u: AdminUser, newPassword: string) => {
    await runWithToast(
      "Reset password",
      () => resetMut.mutateAsync({ id: u.id, newPassword }),
      `Password reset for ${u.username}`,
    );
  };
  const handleDeleteUser = (u: AdminUser) => {
    if (
      !confirm(
        `Delete user "${u.username}"? This permanently removes their messages, DMs and rooms. This cannot be undone.`,
      )
    )
      return;
    runWithToast("Delete", () => deleteUserMut.mutateAsync(u.id), `${u.username} deleted`).then(
      () => {
        if (selectedId === u.id) setSelectedId(undefined);
      },
    );
  };
  const handleDeleteMsg = (id: number) => {
    if (!confirm("Delete this message?")) return;
    runWithToast("Delete message", () => deleteMsgMut.mutateAsync(id), "Message deleted").then(
      () => detail.refetch(),
    );
  };
  const handleDeleteDm = (id: number) => {
    if (!confirm("Delete this direct message?")) return;
    runWithToast("Delete message", () => deleteDmMut.mutateAsync(id), "Direct message deleted").then(
      () => detail.refetch(),
    );
  };

  const pendingAny =
    disableMut.isPending ||
    enableMut.isPending ||
    promoteMut.isPending ||
    demoteMut.isPending ||
    resetMut.isPending ||
    deleteUserMut.isPending ||
    deleteMsgMut.isPending ||
    deleteDmMut.isPending;

  return (
    <div className="h-full flex min-h-0">
      <aside
        className={cn(
          "border-r border-border/50 bg-sidebar flex flex-col min-h-0",
          "w-full md:w-96 md:max-w-[28rem]",
          selectedId !== undefined && "hidden md:flex",
        )}
      >
        <div className="p-3 border-b border-border/50 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "All" },
              { id: "online", label: "Online" },
              { id: "admins", label: "Admins" },
              { id: "disabled", label: "Disabled" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as typeof filter)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                  filter === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {usersLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No users match.</div>
        ) : (
          <ScrollArea className="flex-1">
            <ul className="divide-y divide-border/50">
              {filtered.map((u) => {
                const active = selectedId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      onClick={() => setSelectedId(u.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3",
                        active && "bg-muted/70",
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          username={u.username}
                          avatar={u.avatar ?? null}
                          size="md"
                        />
                        {u.online && (
                          <span
                            className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-sidebar"
                            aria-label="Online"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate">
                            {u.username}
                          </span>
                          {u.isAdmin && (
                            <Badge variant="secondary" className="h-5 text-[10px] gap-1 px-1.5">
                              <Crown className="h-3 w-3 text-amber-500" />
                              admin
                            </Badge>
                          )}
                          {u.isDisabled && (
                            <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
                              disabled
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Joined {formatDistanceToNow(u.createdAt, { addSuffix: true })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {u.roomMessageCount} room msgs · {u.dmCount} DMs · {u.roomsOwned} owned
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </aside>

      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 bg-background min-h-0",
          selectedId === undefined && "hidden md:flex",
        )}
      >
        {selectedId === undefined ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-16 w-16 bg-primary/5 rounded-2xl flex items-center justify-center mb-4 border border-primary/10">
              <Shield className="h-8 w-8 text-primary/40" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Select a user</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Choose someone from the list to view their messages and manage their account.
            </p>
          </div>
        ) : detail.isLoading || !detail.data ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <UserDetailPanel
            data={detail.data}
            currentUserId={meId}
            onClose={() => setSelectedId(undefined)}
            onDisable={() => {
              const u = users?.find((x) => x.id === selectedId);
              if (u) handleDisable(u);
            }}
            onEnable={() => {
              const u = users?.find((x) => x.id === selectedId);
              if (u) handleEnable(u);
            }}
            onPromote={() => {
              const u = users?.find((x) => x.id === selectedId);
              if (u) handlePromote(u);
            }}
            onDemote={() => {
              const u = users?.find((x) => x.id === selectedId);
              if (u) handleDemote(u);
            }}
            onResetPassword={(pwd) => {
              const u = users?.find((x) => x.id === selectedId);
              if (u) return handleResetPassword(u, pwd);
              return Promise.resolve();
            }}
            onDeleteUser={() => {
              const u = users?.find((x) => x.id === selectedId);
              if (u) handleDeleteUser(u);
            }}
            onDeleteMessage={handleDeleteMsg}
            onDeleteDm={handleDeleteDm}
            busy={pendingAny}
          />
        )}
      </main>
    </div>
  );
}

/* ----------------------------- USER DETAIL PANEL ---------------------------- */

function UserDetailPanel({
  data,
  currentUserId,
  onClose,
  onDisable,
  onEnable,
  onPromote,
  onDemote,
  onResetPassword,
  onDeleteUser,
  onDeleteMessage,
  onDeleteDm,
  busy,
}: {
  data: NonNullable<ReturnType<typeof useAdminUserDetail>["data"]>;
  currentUserId: number;
  onClose: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onResetPassword: (newPassword: string) => Promise<void> | void;
  onDeleteUser: () => void;
  onDeleteMessage: (id: number) => void;
  onDeleteDm: (id: number) => void;
  busy: boolean;
}) {
  const { user, rooms, roomMessages, dms } = data;
  const isSelf = user.id === currentUserId;
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd || newPwd.length < 6) return;
    setSubmitting(true);
    try {
      await onResetPassword(newPwd);
      setPwdOpen(false);
      setNewPwd("");
      setConfirmPwd("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="border-b border-border/50 px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden h-9 w-9 -ml-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="relative shrink-0">
            <Avatar
              username={user.username}
              avatar={user.avatar ?? null}
              size="lg"
            />
            {user.online && (
              <span
                className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background"
                aria-label="Online"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground truncate">{user.username}</h2>
              {user.isAdmin && (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="h-3 w-3 text-amber-500" /> admin
                </Badge>
              )}
              {user.isDisabled && <Badge variant="destructive">disabled</Badge>}
              {user.online && (
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 gap-1">
                  <Circle className="h-2 w-2 fill-current" /> online
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ID #{user.id} · joined {formatDistanceToNow(user.createdAt, { addSuffix: true })}
              {user.lastSeen && !user.online && (
                <> · last seen {formatDistanceToNow(user.lastSeen, { addSuffix: true })}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {user.isDisabled ? (
            <Button size="sm" variant="outline" onClick={onEnable} disabled={busy}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Re-enable
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onDisable}
              disabled={busy || user.isAdmin || isSelf}
            >
              <Ban className="h-4 w-4 mr-1.5" /> Disable
            </Button>
          )}
          {user.isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onDemote}
              disabled={busy || isSelf}
            >
              <ArrowDown className="h-4 w-4 mr-1.5" /> Remove admin
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onPromote}
              disabled={busy || user.isDisabled}
            >
              <ArrowUp className="h-4 w-4 mr-1.5" /> Make admin
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setPwdOpen(true)} disabled={busy}>
            <KeyRound className="h-4 w-4 mr-1.5" /> Reset password
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDeleteUser}
            disabled={busy || user.isAdmin || isSelf}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete account
          </Button>
        </div>
        {(user.isAdmin || isSelf) && (
          <p className="text-xs text-muted-foreground mt-2">
            {isSelf
              ? "You cannot disable, demote or delete your own account."
              : "Other admin accounts cannot be disabled or deleted — demote them first."}
          </p>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 sm:p-6 space-y-8">
          <Section
            title="Rooms"
            icon={<Hash className="h-4 w-4" />}
            emptyText="Not a member of any rooms."
            count={rooms.length}
          >
            <ul className="space-y-2">
              {rooms.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.code}</p>
                  </div>
                  {r.isOwner && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      owner
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Recent room messages"
            icon={<Hash className="h-4 w-4" />}
            emptyText="No room messages."
            count={roomMessages.length}
            note={roomMessages.length === 200 ? "Showing the most recent 200." : undefined}
          >
            <ul className="space-y-2">
              {roomMessages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border border-border/50 bg-background px-3 py-2 group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-muted-foreground truncate">
                      in <span className="font-medium text-foreground">{m.roomName}</span> ·{" "}
                      {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                      onClick={() => onDeleteMessage(m.id)}
                      disabled={busy}
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {m.content && (
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {m.content}
                    </p>
                  )}
                  {m.attachmentName && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      attachment: {m.attachmentName}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Direct messages"
            icon={<MessageSquare className="h-4 w-4" />}
            emptyText="No direct messages."
            count={dms.length}
            note={dms.length === 200 ? "Showing the most recent 200." : undefined}
          >
            <ul className="space-y-2">
              {dms.map((d) => {
                const sentByUser = d.senderId === user.id;
                return (
                  <li
                    key={d.id}
                    className="rounded-md border border-border/50 bg-background px-3 py-2 group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {sentByUser ? "to" : "from"}{" "}
                        <span className="font-medium text-foreground">
                          {sentByUser ? d.recipientUsername : d.senderUsername}
                        </span>{" "}
                        · {formatDistanceToNow(d.createdAt, { addSuffix: true })}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                        onClick={() => onDeleteDm(d.id)}
                        disabled={busy}
                        aria-label="Delete direct message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {d.content && (
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {d.content}
                      </p>
                    )}
                    {d.attachmentName && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        attachment: {d.attachmentName}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      </ScrollArea>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {user.username}</DialogTitle>
            <DialogDescription>
              Set a new password for this user. Share it with them through a secure channel — they
              should change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPassword} className="space-y-3 py-2">
            <div>
              <Label htmlFor="admin-new-pwd">New password</Label>
              <Input
                id="admin-new-pwd"
                type="text"
                autoComplete="off"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="mt-1.5 font-mono"
                minLength={6}
                required
              />
            </div>
            <div>
              <Label htmlFor="admin-confirm-pwd">Confirm new password</Label>
              <Input
                id="admin-confirm-pwd"
                type="text"
                autoComplete="off"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="mt-1.5 font-mono"
                minLength={6}
                required
              />
            </div>
            {newPwd && confirmPwd && newPwd !== confirmPwd && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPwdOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || newPwd.length < 6 || newPwd !== confirmPwd}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ----------------------------------- ROOMS ---------------------------------- */

function RoomsPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { data: rooms, isLoading } = useAdminRooms();
  const deleteRoom = useDeleteAdminRoom();
  const [search, setSearch] = useState("");

  const handleDelete = (room: { id: number; name: string }) => {
    if (
      !confirm(
        `Delete room "${room.name}"? All messages and members in this room will be removed permanently.`,
      )
    )
      return;
    deleteRoom
      .mutateAsync(room.id)
      .then(() => toast({ title: `Room "${room.name}" deleted` }))
      .catch((err: any) =>
        toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = (rooms || []).filter(
    (r) =>
      r.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      r.code.toLowerCase().includes(search.trim().toLowerCase()) ||
      r.ownerUsername.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold mb-1">Rooms</h2>
          <p className="text-sm text-muted-foreground">
            All rooms across the workspace, including their owners and activity.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or owner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-background"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border/50 rounded-lg">
          No rooms found.
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2.5">Name</th>
                <th className="text-left font-medium px-3 py-2.5 hidden sm:table-cell">Code</th>
                <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Owner</th>
                <th className="text-right font-medium px-3 py-2.5">Members</th>
                <th className="text-right font-medium px-3 py-2.5 hidden sm:table-cell">Messages</th>
                <th className="text-left font-medium px-3 py-2.5 hidden lg:table-cell">Last activity</th>
                <th className="text-right font-medium px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden font-mono">{r.code}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs hidden sm:table-cell">{r.code}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell">{r.ownerUsername}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.memberCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">
                    {r.messageCount}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                    {r.lastMessageAt
                      ? formatDistanceToNow(r.lastMessageAt, { addSuffix: true })
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(r)}
                      disabled={deleteRoom.isPending}
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- HELPERS --------------------------------- */

function Section({
  title,
  icon,
  count,
  emptyText,
  note,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  emptyText: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="outline" className="text-[10px] h-5">
          {count}
        </Badge>
        {note && <span className="text-xs text-muted-foreground ml-auto">{note}</span>}
      </div>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  );
}
