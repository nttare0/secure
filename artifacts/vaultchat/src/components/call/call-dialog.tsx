import { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneIncoming,
  Monitor,
  MonitorOff,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import type { ActiveCall, GroupCallState, GroupParticipant, GroupInvite } from "@/hooks/use-call";

interface CallDialogProps {
  call: ActiveCall;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  screenSharing: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  groupCall: GroupCallState | null;
  groupInvite: GroupInvite | null;
  groupParticipants: Map<number, GroupParticipant>;
  onJoinGroup: () => void;
  onDeclineGroup: () => void;
  onLeaveGroup: () => void;
}

function VideoTile({
  stream,
  username,
  muted: audioMuted = false,
  isSelf = false,
  isSmall = false,
}: {
  stream: MediaStream | null;
  username: string;
  muted?: boolean;
  isSelf?: boolean;
  isSmall?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = stream ? stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live") : false;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={cn("relative rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center", isSmall && "rounded-lg")}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={audioMuted}
        className={cn(
          "w-full h-full object-cover",
          isSelf && "scale-x-[-1]",
          !hasVideo && "hidden",
        )}
      />
      {!hasVideo && (
        <div className="flex flex-col items-center gap-2 p-3">
          <Avatar username={username} size={isSmall ? "sm" : "lg"} />
          {!isSmall && <span className="text-white/80 text-xs font-medium">{username}</span>}
        </div>
      )}
      {hasVideo && (
        <div className="absolute bottom-2 left-2 text-white text-xs font-medium bg-black/50 rounded px-1.5 py-0.5">
          {username}{isSelf ? " (you)" : ""}
        </div>
      )}
    </div>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallDialog({
  call,
  localStream,
  remoteStream,
  muted,
  cameraOff,
  screenSharing,
  onAccept,
  onDecline,
  onHangUp,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  groupCall,
  groupInvite,
  groupParticipants,
  onJoinGroup,
  onDeclineGroup,
  onLeaveGroup,
}: CallDialogProps) {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const startedAt = call.startedAt ?? groupCall?.startedAt ?? null;
  const isInCall = call.status === "in-call" || groupCall?.status === "in-call";

  useEffect(() => {
    if (!isInCall || !startedAt) { setElapsed(0); return; }
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isInCall, startedAt]);

  const isVideo = call.kind === "video" || groupCall?.kind === "video";

  const Controls = (
    <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex items-center justify-center gap-3 bg-gradient-to-t from-black/90 to-transparent">
      <Button
        size="lg"
        variant={muted ? "default" : "secondary"}
        onClick={onToggleMute}
        className="rounded-full h-12 w-12 p-0"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      {isVideo && (
        <Button
          size="lg"
          variant={cameraOff ? "default" : "secondary"}
          onClick={onToggleCamera}
          className="rounded-full h-12 w-12 p-0"
          aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {cameraOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
        </Button>
      )}
      {isVideo && (
        <Button
          size="lg"
          variant={screenSharing ? "default" : "secondary"}
          onClick={onToggleScreenShare}
          className={cn("rounded-full h-12 w-12 p-0", screenSharing && "ring-2 ring-blue-400")}
          aria-label={screenSharing ? "Stop screen share" : "Share screen"}
        >
          {screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </Button>
      )}
      <Button
        size="lg"
        variant="destructive"
        onClick={groupCall ? onLeaveGroup : onHangUp}
        className="rounded-full h-14 w-14 p-0"
        aria-label="Hang up"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );

  if (groupInvite && !groupCall) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-5 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Group call invite</p>
              <p className="text-white/60 text-xs">
                <span className="text-white font-medium">{groupInvite.fromUsername}</span> started a {groupInvite.kind} call in your room
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="destructive" className="flex-1 rounded-full" onClick={onDeclineGroup}>
              <PhoneOff className="h-4 w-4 mr-2" /> Decline
            </Button>
            <Button className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onJoinGroup}>
              <Phone className="h-4 w-4 mr-2" /> Join
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (groupCall) {
    const allParticipants = Array.from(groupParticipants.values());
    const totalTiles = allParticipants.length + 1;
    const gridCols = totalTiles <= 1 ? "grid-cols-1" : totalTiles <= 2 ? "grid-cols-2" : totalTiles <= 4 ? "grid-cols-2" : "grid-cols-3";

    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 text-white">
            <Users className="h-4 w-4 text-white/60" />
            <span className="text-sm font-medium">{totalTiles} in call</span>
            {isInCall && startedAt && <span className="text-white/50 text-xs ml-1">{formatElapsed(elapsed)}</span>}
          </div>
          {groupCall.status === "calling" && (
            <span className="text-white/50 text-xs animate-pulse">Starting call…</span>
          )}
        </div>

        <div className={cn("flex-1 grid gap-1 p-1 min-h-0", gridCols)}>
          <VideoTile stream={localStream} username="You" muted isSelf />
          {allParticipants.map((p) => (
            <VideoTile key={p.userId} stream={p.stream} username={p.username} />
          ))}
        </div>

        <div className="relative h-20 shrink-0">
          {Controls}
        </div>
      </div>
    );
  }

  if (call.status === "idle") return null;

  const isRemoteVideo = isVideo && (call.status === "in-call" || call.status === "connecting");
  const showLocalPip = isVideo && !!localStream;

  const statusLabel = (() => {
    switch (call.status) {
      case "calling": return "Calling…";
      case "ringing": return call.isCaller ? "Ringing…" : "Incoming call";
      case "connecting": return "Connecting…";
      case "in-call": return formatElapsed(elapsed);
      case "ended": return call.errorMessage ?? "Call ended";
      default: return "";
    }
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-3xl aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden bg-zinc-950 shadow-2xl ring-1 ring-white/10 flex flex-col">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
          {isRemoteVideo ? (
            <video
              autoPlay
              playsInline
              ref={(el) => { if (el) el.srcObject = remoteStream; }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="scale-150">
                <Avatar username={call.peerUsername} size="lg" />
              </div>
              <div className="text-white text-2xl font-semibold mt-4">{call.peerUsername}</div>
              <div className="text-white/70 text-sm flex items-center gap-2">
                {call.status === "ringing" && !call.isCaller && (
                  <PhoneIncoming className="h-4 w-4 animate-pulse" />
                )}
                {statusLabel}
              </div>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        </div>

        {showLocalPip && (
          <div className="absolute top-3 right-3 w-28 h-40 sm:w-40 sm:h-28 rounded-lg overflow-hidden ring-2 ring-white/30 bg-black shadow-lg z-10">
            <video
              autoPlay
              playsInline
              muted
              ref={(el) => { if (el) el.srcObject = localStream; }}
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {cameraOff && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <VideoOff className="h-6 w-6 text-white/70" />
              </div>
            )}
          </div>
        )}

        {isRemoteVideo && (
          <div className="absolute top-3 left-3 right-44 sm:right-48 flex items-center gap-3 text-white z-10">
            <Avatar username={call.peerUsername} size="sm" />
            <div className="min-w-0">
              <div className="font-semibold truncate">{call.peerUsername}</div>
              <div className="text-xs text-white/70">{statusLabel}</div>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex items-center justify-center gap-3 sm:gap-4 bg-gradient-to-t from-black/80 to-transparent z-10">
          {call.status === "ringing" && !call.isCaller ? (
            <>
              <Button size="lg" variant="destructive" onClick={onDecline} className="rounded-full h-14 w-14 p-0" aria-label="Decline">
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button size="lg" onClick={onAccept} className="rounded-full h-14 w-14 p-0 bg-emerald-600 hover:bg-emerald-700" aria-label="Accept">
                <Phone className="h-6 w-6" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                variant={muted ? "default" : "secondary"}
                onClick={onToggleMute}
                className="rounded-full h-12 w-12 p-0"
                disabled={!localStream}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              {isVideo && (
                <Button
                  size="lg"
                  variant={cameraOff ? "default" : "secondary"}
                  onClick={onToggleCamera}
                  className="rounded-full h-12 w-12 p-0"
                  disabled={!localStream}
                >
                  {cameraOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                </Button>
              )}
              {isVideo && call.status === "in-call" && (
                <Button
                  size="lg"
                  variant={screenSharing ? "default" : "secondary"}
                  onClick={onToggleScreenShare}
                  className={cn("rounded-full h-12 w-12 p-0", screenSharing && "ring-2 ring-blue-400")}
                >
                  {screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                </Button>
              )}
              <Button size="lg" variant="destructive" onClick={onHangUp} className="rounded-full h-14 w-14 p-0">
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
