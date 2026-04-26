import { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneIncoming,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import type { ActiveCall } from "@/hooks/use-call";

interface CallDialogProps {
  call: ActiveCall;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

export function CallDialog({
  call,
  localStream,
  remoteStream,
  muted,
  cameraOff,
  onAccept,
  onDecline,
  onHangUp,
  onToggleMute,
  onToggleCamera,
}: CallDialogProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (call.status !== "in-call" || !call.startedAt) {
      setElapsed(0);
      return;
    }
    const start = call.startedAt;
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [call.status, call.startedAt]);

  if (call.status === "idle") return null;

  const isVideo = call.kind === "video";
  const showRemoteVideo =
    isVideo && (call.status === "in-call" || call.status === "connecting");
  const showLocalVideo = isVideo && localStream;

  const statusLabel = (() => {
    switch (call.status) {
      case "calling":
        return "Calling…";
      case "ringing":
        return call.isCaller ? "Ringing…" : "Incoming call";
      case "connecting":
        return "Connecting…";
      case "in-call":
        return formatElapsed(elapsed);
      case "ended":
        return call.errorMessage ?? "Call ended";
      default:
        return "";
    }
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-3xl aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden bg-zinc-950 shadow-2xl ring-1 ring-white/10 flex flex-col">
        {/* Remote video (or avatar fallback) */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
          {showRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="scale-150">
                <Avatar username={call.peerUsername} size="lg" />
              </div>
              <div className="text-white text-2xl font-semibold mt-4">
                {call.peerUsername}
              </div>
              <div className="text-white/70 text-sm flex items-center gap-2">
                {call.status === "ringing" && !call.isCaller && (
                  <PhoneIncoming className="h-4 w-4 animate-pulse" />
                )}
                {statusLabel}
              </div>
            </div>
          )}
          {/* Always render audio for audio-only calls */}
          {!isVideo && (
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          )}
        </div>

        {/* Local preview (video calls only) */}
        {showLocalVideo && (
          <div className="absolute top-3 right-3 w-28 h-40 sm:w-40 sm:h-28 rounded-lg overflow-hidden ring-2 ring-white/30 bg-black shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {cameraOff && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <VideoOff className="h-6 w-6 text-white/70" />
              </div>
            )}
          </div>
        )}

        {/* Top-bar peer info (only when remote video is shown) */}
        {showRemoteVideo && (
          <div className="absolute top-3 left-3 right-44 sm:right-48 flex items-center gap-3 text-white">
            <Avatar username={call.peerUsername} size="sm" />
            <div className="min-w-0">
              <div className="font-semibold truncate">{call.peerUsername}</div>
              <div className="text-xs text-white/70">{statusLabel}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex items-center justify-center gap-3 sm:gap-4 bg-gradient-to-t from-black/80 to-transparent">
          {call.status === "ringing" && !call.isCaller ? (
            <>
              <Button
                size="lg"
                variant="destructive"
                onClick={onDecline}
                className="rounded-full h-14 w-14 p-0"
                aria-label="Decline call"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                size="lg"
                onClick={onAccept}
                className="rounded-full h-14 w-14 p-0 bg-emerald-600 hover:bg-emerald-700"
                aria-label="Accept call"
              >
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
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
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
                  aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                  disabled={!localStream}
                >
                  {cameraOff ? (
                    <VideoOff className="h-5 w-5" />
                  ) : (
                    <VideoIcon className="h-5 w-5" />
                  )}
                </Button>
              )}
              <Button
                size="lg"
                variant="destructive"
                onClick={onHangUp}
                className="rounded-full h-14 w-14 p-0"
                aria-label="Hang up"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
