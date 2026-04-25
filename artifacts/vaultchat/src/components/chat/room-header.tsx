import { Room, useDeleteRoom, useLeaveRoom, useRoomMembers } from "@/hooks/use-rooms";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, Copy, Check, Users, MoreVertical, LogOut, Trash2, Hash } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface RoomHeaderProps {
  room: Room;
  onClearSelection: () => void;
  menuSlot?: React.ReactNode;
}

export function RoomHeader({ room, onClearSelection, menuSlot }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const { data: members } = useRoomMembers(room.id);
  const leaveRoom = useLeaveRoom();
  const deleteRoom = useDeleteRoom();
  const { toast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    toast({ title: "Invite code copied", description: "Share this code to let others join." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    if (confirm("Are you sure you want to leave this room?")) {
      leaveRoom.mutate(room.id, {
        onSuccess: () => {
          onClearSelection();
          toast({ title: "Left room", description: `You have left ${room.name}` });
        }
      });
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this room? This action cannot be undone and will remove all messages.")) {
      deleteRoom.mutate(room.id, {
        onSuccess: () => {
          onClearSelection();
          toast({ title: "Room deleted", description: `Room ${room.name} has been deleted` });
        }
      });
    }
  };

  return (
    <div className="h-14 sm:h-16 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-between px-3 sm:px-6 shrink-0 z-10 sticky top-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        {menuSlot}
        <div className="h-9 w-9 sm:h-10 sm:w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
          <Hash className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-foreground leading-tight truncate">{room.name}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {members?.length || room.memberCount} members
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3" /> Secure
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 bg-muted/50 border-dashed hover:bg-muted"
              onClick={handleCopyCode}
            >
              <span className="font-mono text-xs font-medium text-foreground tracking-wide">{room.code}</span>
              <div className="hidden sm:block h-4 w-px bg-border/80 mx-1" />
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy invite code</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Room Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLeave} disabled={leaveRoom.isPending}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Leave Room</span>
            </DropdownMenuItem>
            {room.isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} disabled={deleteRoom.isPending} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Room</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
