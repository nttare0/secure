import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRooms } from "@/hooks/use-rooms";
import { useMessages, type Message } from "@/hooks/use-messages";
import { useDmThread } from "@/hooks/use-dms";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/chat/composer";
import { RoomHeader } from "@/components/chat/room-header";
import { DmHeader } from "@/components/chat/dm-header";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, Menu } from "lucide-react";
import type { Selection } from "@/lib/selection";

export default function Home() {
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: rooms } = useRooms();
  const [, setLocation] = useLocation();
  const [selection, setSelection] = useState<Selection | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!selection && rooms && rooms.length > 0) {
      setSelection({ type: "room", id: rooms[0].id });
    }
  }, [rooms, selection]);

  // Clear reply when switching chats
  useEffect(() => {
    setReplyTo(null);
  }, [selection?.type, selection && (selection.type === "room" ? selection.id : selection.userId)]);

  const handleSelect = (s: Selection) => {
    setSelection(s);
    setSidebarOpen(false);
  };
  const handleClearSelection = () => {
    setSelection(undefined);
    setSidebarOpen(true);
  };

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

  const MenuButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setSidebarOpen(true)}
      className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground -ml-1"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden selection:bg-primary/20">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        selection={selection}
        onSelect={handleSelect}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
        {currentRoom ? (
          <>
            <RoomHeader
              room={currentRoom}
              onClearSelection={handleClearSelection}
              menuSlot={MenuButton}
            />
            {roomMessagesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <MessageList
                messages={roomMessages || []}
                context={{
                  type: "room",
                  id: currentRoom.id,
                  ownerId: currentRoom.isOwner ? user.id : undefined,
                }}
                onReply={setReplyTo}
              />
            )}
            <Composer
              target={{ type: "room", id: currentRoom.id }}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
            />
          </>
        ) : currentDmUserId && dmThread ? (
          <>
            <DmHeader
              username={dmThread.peer.username}
              lastSeen={dmThread.peer.lastSeen}
              menuSlot={MenuButton}
            />
            {dmLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <MessageList
                messages={dmThread.messages}
                context={{ type: "dm", userId: currentDmUserId }}
                onReply={setReplyTo}
              />
            )}
            <Composer
              target={{ type: "dm", userId: currentDmUserId }}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
            />
          </>
        ) : currentDmUserId ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <>
            <div className="h-14 sm:h-16 border-b border-border/50 flex items-center px-4 sm:px-6 md:hidden">
              {MenuButton}
              <span className="ml-2 font-semibold text-foreground">VaultChat</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-background">
              <div className="h-16 w-16 sm:h-20 sm:w-20 bg-primary/5 rounded-2xl flex items-center justify-center mb-5 sm:mb-6 border border-primary/10 shadow-inner">
                <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-primary/40" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 tracking-tight">
                Your Private Vault
              </h2>
              <p className="text-muted-foreground max-w-md text-sm sm:text-base leading-relaxed">
                Select a room or direct message from the sidebar to start communicating securely.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
