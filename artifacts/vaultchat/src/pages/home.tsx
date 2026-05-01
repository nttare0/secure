import { useState, useEffect, useMemo } from "react";
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
import { useRealtime, getTypingFor } from "@/hooks/use-realtime";
import { useCall } from "@/hooks/use-call";
import { CallDialog } from "@/components/call/call-dialog";
import { wallpaperUrl } from "@/lib/wallpapers";
import { SettingsDialog } from "@/components/settings/settings-dialog";

function buildTypingLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`;
}

export default function Home() {
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: rooms } = useRooms();
  const [, setLocation] = useLocation();
  const [selection, setSelection] = useState<Selection | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { typing, onlineUsers, sendTyping, send, subscribe } = useRealtime({
    enabled: !!user,
    myUserId: user?.id,
  });

  const callApi = useCall({
    enabled: !!user,
    myUserId: user?.id ?? null,
    myUsername: user?.username ?? undefined,
    send,
    subscribe,
  });

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

  const wallpaper = useMemo(() => wallpaperUrl(user?.wallpaperId), [user?.wallpaperId]);

  const roomTypingLabel = useMemo(() => {
    if (!currentRoomId) return null;
    const peers = getTypingFor(typing, { type: "room", id: currentRoomId });
    return buildTypingLabel(peers.map((p) => p.username));
  }, [typing, currentRoomId]);

  const dmTypingLabel = useMemo(() => {
    if (!currentDmUserId) return null;
    const peers = getTypingFor(typing, { type: "dm", id: currentDmUserId });
    return buildTypingLabel(peers.map((p) => p.username));
  }, [typing, currentDmUserId]);

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

  const chatBgStyle: React.CSSProperties | undefined = wallpaper
    ? {
        backgroundImage: `url(${wallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "scroll",
      }
    : undefined;
  // When a wallpaper is set, give the room/dm header a subtle translucent background
  // so it doesn't pop with a solid color over the chosen image.
  const wallpaperHeaderStyle: React.CSSProperties | undefined = wallpaper
    ? { background: "transparent" }
    : undefined;

  const dmIsOnline = currentDmUserId
    ? onlineUsers.has(currentDmUserId) ||
      (!!dmThread?.peer.lastSeen && Date.now() - dmThread.peer.lastSeen < 60_000)
    : false;

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
        onlineUsers={onlineUsers}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main
        className="flex-1 flex flex-col min-w-0 bg-background/50 relative"
        style={chatBgStyle}
      >
        {wallpaper && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-background/20 to-background/40 dark:from-background/40 dark:via-background/30 dark:to-background/55" aria-hidden />
        )}
        <div className="relative flex-1 flex flex-col min-h-0">
        {currentRoom ? (
          <>
            <RoomHeader
              room={currentRoom}
              onClearSelection={handleClearSelection}
              menuSlot={MenuButton}
              typingLabel={roomTypingLabel}
              callDisabled={
                (callApi.call.status !== "idle" && callApi.call.status !== "ended") ||
                !!callApi.groupCall
              }
              onAudioCall={() =>
                callApi.startGroupCall(currentRoom.id, "audio")
              }
              onVideoCall={() =>
                callApi.startGroupCall(currentRoom.id, "video")
              }
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
              onTyping={() => sendTyping({ type: "room", id: currentRoom.id })}
            />
          </>
        ) : currentDmUserId && dmThread ? (
          <>
            <DmHeader
              username={dmThread.peer.username}
              lastSeen={dmThread.peer.lastSeen}
              avatar={(dmThread.peer as any).avatar ?? null}
              isOnline={dmIsOnline}
              typingLabel={dmTypingLabel}
              menuSlot={MenuButton}
              callDisabled={
                callApi.call.status !== "idle" && callApi.call.status !== "ended"
              }
              onAudioCall={() =>
                callApi.startCall(
                  dmThread.peer.id,
                  dmThread.peer.username,
                  "audio",
                )
              }
              onVideoCall={() =>
                callApi.startCall(
                  dmThread.peer.id,
                  dmThread.peer.username,
                  "video",
                )
              }
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
              onTyping={() => sendTyping({ type: "dm", id: currentDmUserId })}
            />
          </>
        ) : currentDmUserId ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <>
            <div className="h-14 sm:h-16 border-b border-border/50 flex items-center px-4 sm:px-6 md:hidden bg-background/95 backdrop-blur">
              {MenuButton}
              <span className="ml-2 font-semibold text-foreground">VaultChat</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center">
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
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <CallDialog
        call={callApi.call}
        localStream={callApi.localStream}
        remoteStream={callApi.remoteStream}
        muted={callApi.muted}
        cameraOff={callApi.cameraOff}
        screenSharing={callApi.screenSharing}
        onAccept={callApi.accept}
        onDecline={callApi.decline}
        onHangUp={callApi.hangUp}
        onToggleMute={callApi.toggleMute}
        onToggleCamera={callApi.toggleCamera}
        onToggleScreenShare={callApi.toggleScreenShare}
        groupCall={callApi.groupCall}
        groupInvite={callApi.groupInvite}
        groupParticipants={callApi.groupParticipants}
        onJoinGroup={() => callApi.groupInvite && callApi.joinGroupCall(callApi.groupInvite)}
        onDeclineGroup={callApi.declineGroupInvite}
        onLeaveGroup={callApi.leaveGroupCall}
      />
    </div>
  );
}
