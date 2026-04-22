import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useRooms, useCreateRoom, useJoinRoom } from "@/hooks/use-rooms";
import { useDms, useSearchUsers } from "@/hooks/use-dms";
import type { Selection } from "@/lib/selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import {
  Shield,
  Plus,
  Hash,
  LogOut,
  Loader2,
  MessageSquare,
  KeyRound,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SidebarProps {
  selection?: Selection;
  onSelect: (s: Selection) => void;
}

export function Sidebar({ selection, onSelect }: SidebarProps) {
  const { data: user } = useAuth();
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const { data: dms, isLoading: dmsLoading } = useDms();
  const logout = useLogout();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isDmOpen, setIsDmOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [dmSearch, setDmSearch] = useState("");
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(dmSearch);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("/login") });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    createRoom.mutate(
      { name: newRoomName },
      {
        onSuccess: (room) => {
          setIsCreateOpen(false);
          setNewRoomName("");
          onSelect({ type: "room", id: room.id });
          toast({ title: "Room created", description: `Welcome to ${room.name}` });
        },
        onError: (err: any) => {
          toast({ title: "Error creating room", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    joinRoom.mutate(
      { code: joinCode },
      {
        onSuccess: (room) => {
          setIsJoinOpen(false);
          setJoinCode("");
          onSelect({ type: "room", id: room.id });
          toast({ title: "Joined room", description: `Welcome to ${room.name}` });
        },
        onError: (err: any) => {
          toast({ title: "Error joining room", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const startDm = (userId: number, username: string) => {
    setIsDmOpen(false);
    setDmSearch("");
    onSelect({ type: "dm", userId });
    toast({ title: "Opened conversation", description: `with ${username}` });
  };

  return (
    <div className="w-80 flex-shrink-0 border-r border-border bg-sidebar flex flex-col h-full overflow-hidden">
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground">VaultChat</span>
        </div>
      </div>

      <Tabs defaultValue="rooms" className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rooms" className="gap-1.5">
              <Hash className="h-3.5 w-3.5" /> Rooms
            </TabsTrigger>
            <TabsTrigger value="direct" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Direct
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rooms" className="flex-1 overflow-y-auto p-3 mt-0 data-[state=inactive]:hidden">
          {roomsLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rooms?.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border/50">
              No rooms yet. Create or join one to start chatting.
            </div>
          ) : (
            <div className="space-y-1">
              {rooms?.map((room) => {
                const active = selection?.type === "room" && selection.id === room.id;
                return (
                  <button
                    key={room.id}
                    onClick={() => onSelect({ type: "room", id: room.id })}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Hash className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <span className="truncate block">{room.name}</span>
                      <span className="text-xs text-sidebar-foreground/50 truncate block mt-0.5">
                        {room.lastMessageAt
                          ? formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: true })
                          : "No messages"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="direct" className="flex-1 overflow-y-auto p-3 mt-0 data-[state=inactive]:hidden">
          {dmsLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !dms || dms.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border/50">
              No direct messages yet. Start one below.
            </div>
          ) : (
            <div className="space-y-1">
              {dms.map((c) => {
                const active = selection?.type === "dm" && selection.userId === c.userId;
                return (
                  <button
                    key={c.userId}
                    onClick={() => onSelect({ type: "dm", userId: c.userId })}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-medium",
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {c.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <span className="truncate block">{c.username}</span>
                      <span className="text-xs text-sidebar-foreground/50 truncate block mt-0.5">
                        {c.lastMessage
                          ? c.lastMessage
                          : c.lastMessageAt
                            ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })
                            : "No messages yet"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="p-3 border-t border-border/50 bg-sidebar-accent/20 shrink-0 space-y-2">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start border-dashed bg-transparent hover:bg-sidebar-accent">
              <Plus className="h-4 w-4 mr-2" /> Create Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new secure room</DialogTitle>
              <DialogDescription>
                Rooms are private spaces for conversation. You'll get an invite code to share with others.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRoom}>
              <div className="py-4">
                <Label htmlFor="name">Room Name</Label>
                <Input
                  id="name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Project Alpha, Family Chat..."
                  className="mt-2"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRoom.isPending || !newRoomName.trim()}>
                  {createRoom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Room
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start bg-transparent hover:bg-sidebar-accent">
              <KeyRound className="h-4 w-4 mr-2" /> Join with Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join an existing room</DialogTitle>
              <DialogDescription>Enter the invite code shared with you to join a secure room.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoinRoom}>
              <div className="py-4">
                <Label htmlFor="code">Invite Code</Label>
                <Input
                  id="code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. ABC123DE"
                  className="mt-2 font-mono"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsJoinOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={joinRoom.isPending || !joinCode.trim()}>
                  {joinRoom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Join Room
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isDmOpen} onOpenChange={setIsDmOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start bg-transparent hover:bg-sidebar-accent">
              <MessageSquare className="h-4 w-4 mr-2" /> New Direct Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a direct message</DialogTitle>
              <DialogDescription>Search for a user by their username to begin a private conversation.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={dmSearch}
                  onChange={(e) => setDmSearch(e.target.value)}
                  placeholder="Search username..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border/50">
                {dmSearch.trim().length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Type a username to search.
                  </div>
                ) : searchLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !searchResults || searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No users found.</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => startDm(u.id, u.username)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-sidebar-accent/50 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium shrink-0">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-3 border-t border-border/50 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium shrink-0">
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <div className="truncate">
            <span className="text-sm font-medium block truncate">{user?.username}</span>
            <span className="text-xs text-muted-foreground block truncate">Secure connection</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
