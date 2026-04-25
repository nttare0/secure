import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useAdminUsers,
  useAdminUserDetail,
  useDisableUser,
  useEnableUser,
  useDeleteUser,
  useDeleteAdminMessage,
  useDeleteAdminDm,
  type AdminUser,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function Admin() {
  const { data: me, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const detail = useAdminUserDetail(selectedId);
  const disableMut = useDisableUser();
  const enableMut = useEnableUser();
  const deleteUserMut = useDeleteUser();
  const deleteMsgMut = useDeleteAdminMessage();
  const deleteDmMut = useDeleteAdminDm();

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

  const filtered = (users || []).filter((u) =>
    u.username.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const runWithToast = async (
    label: string,
    fn: () => Promise<unknown>,
    successMsg: string,
  ) => {
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
    runWithToast("Enable", () => enableMut.mutateAsync(u.id), `${u.username} enabled`);
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
            Manage users, messages, and accounts
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="hidden sm:inline">{me.username}</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className={cn(
          "border-r border-border/50 bg-sidebar flex flex-col min-h-0",
          "w-full md:w-96 md:max-w-[28rem]",
          selectedId !== undefined && "hidden md:flex",
        )}>
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-background"
              />
            </div>
          </div>
          {usersLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No users found.</div>
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
                        <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium shrink-0">
                          {u.username.charAt(0).toUpperCase()}
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

        <main className={cn(
          "flex-1 flex flex-col min-w-0 bg-background min-h-0",
          selectedId === undefined && "hidden md:flex",
        )}>
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
              currentUserId={me.id}
              onClose={() => setSelectedId(undefined)}
              onDisable={() => {
                const u = users?.find((x) => x.id === selectedId);
                if (u) handleDisable(u);
              }}
              onEnable={() => {
                const u = users?.find((x) => x.id === selectedId);
                if (u) handleEnable(u);
              }}
              onDeleteUser={() => {
                const u = users?.find((x) => x.id === selectedId);
                if (u) handleDeleteUser(u);
              }}
              onDeleteMessage={handleDeleteMsg}
              onDeleteDm={handleDeleteDm}
              busy={
                disableMut.isPending ||
                enableMut.isPending ||
                deleteUserMut.isPending ||
                deleteMsgMut.isPending ||
                deleteDmMut.isPending
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

function UserDetailPanel({
  data,
  currentUserId,
  onClose,
  onDisable,
  onEnable,
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
  onDeleteUser: () => void;
  onDeleteMessage: (id: number) => void;
  onDeleteDm: (id: number) => void;
  busy: boolean;
}) {
  const { user, rooms, roomMessages, dms } = data;
  const isSelf = user.id === currentUserId;
  const protectAdmin = user.isAdmin;

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
          <div className="h-12 w-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold text-lg shrink-0">
            {user.username.charAt(0).toUpperCase()}
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
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ID #{user.id} · joined {formatDistanceToNow(user.createdAt, { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {user.isDisabled ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onEnable}
              disabled={busy || protectAdmin || isSelf}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Re-enable
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onDisable}
              disabled={busy || protectAdmin || isSelf}
            >
              <Ban className="h-4 w-4 mr-1.5" /> Disable
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={onDeleteUser}
            disabled={busy || protectAdmin || isSelf}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete account
          </Button>
        </div>
        {(protectAdmin || isSelf) && (
          <p className="text-xs text-muted-foreground mt-2">
            {isSelf
              ? "You cannot disable or delete your own account."
              : "Other admin accounts cannot be disabled or deleted."}
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
    </>
  );
}

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
