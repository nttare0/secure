import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useRooms, useCreateRoom, useJoinRoom, Room } from "@/hooks/use-rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { Shield, Plus, Hash, LogOut, Loader2, MessageSquare, Menu, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentRoomId?: number;
  onSelectRoom: (id: number) => void;
}

export function Sidebar({ currentRoomId, onSelectRoom }: SidebarProps) {
  const { data: user } = useAuth();
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const logout = useLogout();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      }
    });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    createRoom.mutate({ name: newRoomName }, {
      onSuccess: (room) => {
        setIsCreateOpen(false);
        setNewRoomName("");
        onSelectRoom(room.id);
        toast({ title: "Room created", description: `Welcome to ${room.name}` });
      },
      onError: (err: any) => {
        toast({ title: "Error creating room", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    joinRoom.mutate({ code: joinCode }, {
      onSuccess: (room) => {
        setIsJoinOpen(false);
        setJoinCode("");
        onSelectRoom(room.id);
        toast({ title: "Joined room", description: `Welcome to ${room.name}` });
      },
      onError: (err: any) => {
        toast({ title: "Error joining room", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="w-80 flex-shrink-0 border-r border-border bg-sidebar flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground">VaultChat</span>
        </div>
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Your Rooms</span>
          </div>
          
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
              {rooms?.map((room) => (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    currentRoomId === room.id 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                    currentRoomId === room.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Hash className="h-5 w-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="truncate block">{room.name}</span>
                    </div>
                    <span className="text-xs text-sidebar-foreground/50 truncate block mt-0.5">
                      {room.lastMessageAt ? formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: true }) : "No messages"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border/50 bg-sidebar-accent/20 shrink-0 space-y-2">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start border-dashed bg-transparent hover:bg-sidebar-accent">
              <Plus className="h-4 w-4 mr-2" />
              Create Room
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
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="e.g. Project Alpha, Family Chat..." 
                  className="mt-2"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
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
              <KeyRound className="h-4 w-4 mr-2" />
              Join with Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join an existing room</DialogTitle>
              <DialogDescription>
                Enter the invite code shared with you to join a secure room.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoinRoom}>
              <div className="py-4">
                <Label htmlFor="code">Invite Code</Label>
                <Input 
                  id="code" 
                  value={joinCode} 
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="e.g. abc123def456" 
                  className="mt-2 font-mono"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsJoinOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={joinRoom.isPending || !joinCode.trim()}>
                  {joinRoom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Join Room
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* User Profile */}
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
        <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
