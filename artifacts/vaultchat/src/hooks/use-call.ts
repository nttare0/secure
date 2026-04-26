import { useCallback, useEffect, useRef, useState } from "react";

export type CallKind = "audio" | "video";

export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "in-call"
  | "ended";

export interface ActiveCall {
  status: CallStatus;
  peerId: number;
  peerUsername: string;
  kind: CallKind;
  isCaller: boolean;
  startedAt: number | null;
  errorMessage: string | null;
}

interface UseCallOptions {
  enabled: boolean;
  myUserId: number | null;
  send: (evt: Record<string, unknown>) => boolean;
  subscribe: (cb: (evt: { type: string; [k: string]: any }) => void) => () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const IDLE_CALL: ActiveCall = {
  status: "idle",
  peerId: 0,
  peerUsername: "",
  kind: "audio",
  isCaller: false,
  startedAt: null,
  errorMessage: null,
};

export function useCall({ enabled, myUserId, send, subscribe }: UseCallOptions) {
  const [call, setCall] = useState<ActiveCall>(IDLE_CALL);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    pcRef.current = null;

    const ls = localStreamRef.current;
    if (ls) {
      for (const t of ls.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
    }
    localStreamRef.current = null;

    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOff(false);
  }, []);

  const endLocal = useCallback(
    (reason: string | null = null, notifyPeer = true, peerIdOverride?: number) => {
      const peerId = peerIdOverride ?? pcRef.current ? call.peerId : 0;
      const target = peerIdOverride ?? call.peerId;
      if (notifyPeer && target) {
        send({ type: "call:end", to: target });
      }
      cleanup();
      setCall((c) =>
        c.status === "idle"
          ? c
          : { ...c, status: "ended", errorMessage: reason ?? c.errorMessage },
      );
      // Auto-reset after a moment so the dialog disappears.
      window.setTimeout(() => {
        setCall((c) => (c.status === "ended" ? IDLE_CALL : c));
      }, reason ? 2500 : 800);
      void peerId;
    },
    [call.peerId, cleanup, send],
  );

  const createPc = useCallback(
    (peerId: number) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      setRemoteStream(remote);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send({ type: "call:ice", to: peerId, candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        for (const track of e.streams[0]?.getTracks() ?? [e.track]) {
          if (!remote.getTracks().find((t) => t.id === track.id)) {
            remote.addTrack(track);
          }
        }
        // Force re-render so the video element picks up new tracks.
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setCall((c) =>
            c.status === "idle" || c.status === "ended"
              ? c
              : { ...c, status: "in-call", startedAt: c.startedAt ?? Date.now() },
          );
        } else if (state === "failed" || state === "disconnected" || state === "closed") {
          if (pcRef.current === pc) {
            endLocal(state === "failed" ? "Connection failed" : null, true);
          }
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [endLocal, send],
  );

  const acquireLocalStream = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video",
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(
    async (peerId: number, peerUsername: string, kind: CallKind) => {
      if (!enabled || !myUserId) return;
      if (call.status !== "idle" && call.status !== "ended") return;
      cleanup();
      setCall({
        status: "calling",
        peerId,
        peerUsername,
        kind,
        isCaller: true,
        startedAt: null,
        errorMessage: null,
      });
      try {
        const stream = await acquireLocalStream(kind);
        const pc = createPc(peerId);
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({
          type: "call:offer",
          to: peerId,
          kind,
          sdp: offer,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start call";
        cleanup();
        setCall({
          status: "ended",
          peerId,
          peerUsername,
          kind,
          isCaller: true,
          startedAt: null,
          errorMessage: message,
        });
        send({ type: "call:end", to: peerId });
        window.setTimeout(() => {
          setCall((c) => (c.status === "ended" ? IDLE_CALL : c));
        }, 2500);
      }
    },
    [acquireLocalStream, call.status, cleanup, createPc, enabled, myUserId, send],
  );

  const accept = useCallback(async () => {
    if (call.status !== "ringing" || !pendingOfferRef.current) return;
    const peerId = call.peerId;
    const offer = pendingOfferRef.current;
    pendingOfferRef.current = null;
    setCall((c) => ({ ...c, status: "connecting" }));
    try {
      const stream = await acquireLocalStream(call.kind);
      const pc = createPc(peerId);
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      await pc.setRemoteDescription(offer);
      for (const cand of pendingCandidatesRef.current.splice(0)) {
        try {
          await pc.addIceCandidate(cand);
        } catch {
          /* ignore */
        }
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "call:answer", to: peerId, sdp: answer });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to accept call";
      cleanup();
      setCall((c) => ({
        ...c,
        status: "ended",
        errorMessage: message,
      }));
      send({ type: "call:end", to: peerId });
      window.setTimeout(() => {
        setCall((c) => (c.status === "ended" ? IDLE_CALL : c));
      }, 2500);
    }
  }, [acquireLocalStream, call.kind, call.peerId, call.status, cleanup, createPc, send]);

  const decline = useCallback(() => {
    if (call.status !== "ringing") return;
    send({ type: "call:reject", to: call.peerId });
    cleanup();
    setCall(IDLE_CALL);
  }, [call.peerId, call.status, cleanup, send]);

  const hangUp = useCallback(() => {
    if (call.status === "idle") return;
    endLocal(null, true);
  }, [call.status, endLocal]);

  const toggleMute = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const next = !muted;
    for (const t of ls.getAudioTracks()) t.enabled = !next;
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const next = !cameraOff;
    for (const t of ls.getVideoTracks()) t.enabled = !next;
    setCameraOff(next);
  }, [cameraOff]);

  // Subscribe to incoming signaling events.
  useEffect(() => {
    if (!enabled) return;
    const off = subscribe((evt) => {
      const t = evt.type;
      if (typeof t !== "string" || !t.startsWith("call:")) return;
      const from = Number(evt.from);
      if (!Number.isFinite(from)) return;
      const fromUsername = String(evt.fromUsername ?? "");

      if (t === "call:offer") {
        const kind: CallKind = evt.kind === "video" ? "video" : "audio";
        // Reject if already busy with someone else.
        if (
          (call.status !== "idle" && call.status !== "ended") &&
          call.peerId !== from
        ) {
          send({ type: "call:reject", to: from, reason: "busy" });
          return;
        }
        pendingOfferRef.current = evt.sdp;
        pendingCandidatesRef.current = [];
        setCall({
          status: "ringing",
          peerId: from,
          peerUsername: fromUsername,
          kind,
          isCaller: false,
          startedAt: null,
          errorMessage: null,
        });
        return;
      }

      if (call.peerId !== from) return;

      if (t === "call:answer") {
        const pc = pcRef.current;
        if (!pc || !evt.sdp) return;
        pc
          .setRemoteDescription(evt.sdp)
          .then(async () => {
            for (const cand of pendingCandidatesRef.current.splice(0)) {
              try {
                await pc.addIceCandidate(cand);
              } catch {
                /* ignore */
              }
            }
            setCall((c) =>
              c.status === "calling" ? { ...c, status: "connecting" } : c,
            );
          })
          .catch(() => {
            endLocal("Failed to negotiate", true);
          });
      } else if (t === "call:ice") {
        const pc = pcRef.current;
        if (!evt.candidate) return;
        if (!pc || !pc.remoteDescription) {
          pendingCandidatesRef.current.push(evt.candidate);
          return;
        }
        pc.addIceCandidate(evt.candidate).catch(() => {
          /* ignore */
        });
      } else if (t === "call:reject") {
        cleanup();
        setCall((c) => ({
          ...c,
          status: "ended",
          errorMessage: evt.reason === "busy" ? "User is busy" : "Call declined",
        }));
        window.setTimeout(() => {
          setCall((c) => (c.status === "ended" ? IDLE_CALL : c));
        }, 2000);
      } else if (t === "call:end") {
        cleanup();
        setCall((c) => ({ ...c, status: "ended" }));
        window.setTimeout(() => {
          setCall((c) => (c.status === "ended" ? IDLE_CALL : c));
        }, 800);
      }
    });
    return off;
  }, [call.peerId, call.status, cleanup, enabled, endLocal, send, subscribe]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    call,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    startCall,
    accept,
    decline,
    hangUp,
    toggleMute,
    toggleCamera,
  };
}
