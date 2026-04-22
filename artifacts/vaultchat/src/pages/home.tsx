import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRooms } from "@/hooks/use-rooms";
import { useMessages } from "@/hooks/use-messages";
import { useDmThread } from "@/hooks/use-dms";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/chat/composer";
import { RoomHeader } from "@/components/chat/room-header";
import { DmHeader } from "@/components/chat/dm-header";
import { Shield, Loader2 } from "lucide-react";
import type { Selection } from "@/lib/selection";

export default function Home() {
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: rooms } = useRooms();
  const [, setLocation] = useLocation();
  const [selection, setSelection] = useState<Selection | undefined>();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!selection && rooms && rooms.length > 0) {
      setSelection({ type: "room", id: rooms[0].id });
    }
  }, [rooms, selection]);

  const currentRoomId = selection?.type === "room" ? selection.id : undefined;
  const currentDmUserId = selection?.type === "dm" ? selection.userId : undefined;
  const currentRoom = rooms?.find((r) => r.id === currentRoomId);

  const { data: roomMessages, isLoading: roomMessagesLoading } = useMessages(currentRoomId);
  const { data: dmThread, isLoading: dmLoading } = useDmThread(currentDmUserId);

  if (authLoading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden selection:bg-primary/20">
      <Sidebar selection={selection} onSelect={setSelection} />

      <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
        {currentRoom ? (
          <>
            <RoomHeader room={currentRoom} onClearSelection={() => setSelection(undefined)} />
            {roomMessagesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <MessageList messages={roomMessages || []} />
            )}
            <Composer target={{ type: "room", id: currentRoom.id }} />
          </>
        ) : currentDmUserId && dmThread ? (
          <>
            <DmHeader username={dmThread.peer.username} />
            {dmLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <MessageList messages={dmThread.messages} />
            )}
            <Composer target={{ type: "dm", userId: currentDmUserId }} />
          </>
        ) : currentDmUserId ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
            <div className="h-20 w-20 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 border border-primary/10 shadow-inner">
              <Shield className="h-10 w-10 text-primary/40" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Your Private Vault</h2>
            <p className="text-muted-foreground max-w-md text-base leading-relaxed">
              Select a room or direct message from the sidebar to start communicating securely.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
