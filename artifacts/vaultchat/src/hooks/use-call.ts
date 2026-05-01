import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";

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

export interface GroupParticipant {
  userId: number;
  username: string;
  stream: MediaStream | null;
}

export interface GroupCallState {
  callId: string;
  roomId: number;
  kind: CallKind;
  status: "calling" | "in-call";
  startedAt: number | null;
}

export interface GroupInvite {
  callId: string;
  roomId: number;
  kind: CallKind;
  from: number;
  fromUsername: string;
}

interface UseCallOptions {
  enabled: boolean;
  myUserId: number | null;
  myUsername?: string;
  send: (evt: Record<string, unknown>) => boolean;
  subscribe: (cb: (evt: { type: string; [k: string]: unknown }) => void) => () => void;
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

export function useCall({ enabled, myUserId, myUsername, send, subscribe }: UseCallOptions) {
  const [call, setCall] = useState<ActiveCall>(IDLE_CALL);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const [groupCall, setGroupCall] = useState<GroupCallState | null>(null);
  const [groupInvite, setGroupInvite] = useState<GroupInvite | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<Map<number, GroupParticipant>>(new Map());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const groupPcMapRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const pendingGroupOffersRef = useRef<Map<number, RTCSessionDescriptionInit>>(new Map());
  const pendingGroupCandidatesRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const groupCallRef = useRef<GroupCallState | null>(null);
  const callRef = useRef<ActiveCall>(IDLE_CALL);

  useEffect(() => { groupCallRef.current = groupCall; }, [groupCall]);
  useEffect(() => { callRef.current = call; }, [call]);

  const stopScreenStream = useCallback(() => {
    const ss = screenStreamRef.current;
    if (ss) { for (const t of ss.getTracks()) { try { t.stop(); } catch { /* */ } } }
    screenStreamRef.current = null;
    setScreenSharing(false);
  }, []);

  const cleanup1v1 = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null; pc.ontrack = null; pc.onconnectionstatechange = null;
      try { pc.close(); } catch { /* */ }
    }
    pcRef.current = null;
    const ls = localStreamRef.current;
    if (ls) for (const t of ls.getTracks()) { try { t.stop(); } catch { /* */ } }
    localStreamRef.current = null;
    stopScreenStream();
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOff(false);
  }, [stopScreenStream]);

  const cleanupGroup = useCallback(() => {
    for (const [, pc] of groupPcMapRef.current) { try { pc.close(); } catch { /* */ } }
    groupPcMapRef.current.clear();
    pendingGroupOffersRef.current.clear();
    pendingGroupCandidatesRef.current.clear();
    const ls = localStreamRef.current;
    if (ls) for (const t of ls.getTracks()) { try { t.stop(); } catch { /* */ } }
    localStreamRef.current = null;
    stopScreenStream();
    setLocalStream(null);
    setGroupParticipants(new Map());
    setGroupCall(null);
    groupCallRef.current = null;
    setMuted(false);
    setCameraOff(false);
  }, [stopScreenStream]);

  const saveCallEvent = useCallback(
    (opts: { kind: CallKind; duration: number | null; participants: string[]; peerId?: number; roomId?: number }) => {
      fetchApi("/call-events", {
        method: "POST",
        body: JSON.stringify(opts),
      }).catch(() => {});
    },
    [],
  );

  const endLocal = useCallback(
    (reason: string | null = null, notifyPeer = true) => {
      const c = callRef.current;
      if (notifyPeer && c.peerId) send({ type: "call:end", to: c.peerId });
      if (c.startedAt && c.peerId) {
        saveCallEvent({
          kind: c.kind,
          duration: Math.round((Date.now() - c.startedAt) / 1000),
          participants: [myUsername ?? "", c.peerUsername].filter(Boolean),
          peerId: c.peerId,
        });
      }
      cleanup1v1();
      setCall((prev) =>
        prev.status === "idle"
          ? prev
          : { ...prev, status: "ended", errorMessage: reason ?? prev.errorMessage },
      );
      window.setTimeout(() => setCall((prev) => (prev.status === "ended" ? IDLE_CALL : prev)), reason ? 2500 : 800);
    },
    [cleanup1v1, myUsername, saveCallEvent, send],
  );

  const createPc1v1 = useCallback(
    (peerId: number) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const remote = new MediaStream();

      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: "call:ice", to: peerId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        remote.addTrack(e.track);
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
          if (pcRef.current === pc) endLocal(state === "failed" ? "Connection failed" : null, true);
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
      video: kind === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(
    async (peerId: number, peerUsername: string, kind: CallKind) => {
      if (!enabled || !myUserId) return;
      if (call.status !== "idle" && call.status !== "ended") return;
      if (groupCall) return;
      cleanup1v1();
      setCall({ status: "calling", peerId, peerUsername, kind, isCaller: true, startedAt: null, errorMessage: null });
      try {
        const stream = await acquireLocalStream(kind);
        const pc = createPc1v1(peerId);
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "call:offer", to: peerId, kind, sdp: offer });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start call";
        cleanup1v1();
        setCall({ status: "ended", peerId, peerUsername, kind, isCaller: true, startedAt: null, errorMessage: message });
        send({ type: "call:end", to: peerId });
        window.setTimeout(() => setCall((c) => (c.status === "ended" ? IDLE_CALL : c)), 2500);
      }
    },
    [acquireLocalStream, call.status, cleanup1v1, createPc1v1, enabled, groupCall, myUserId, send],
  );

  const accept = useCallback(async () => {
    if (call.status !== "ringing" || !pendingOfferRef.current) return;
    const peerId = call.peerId;
    const offer = pendingOfferRef.current;
    pendingOfferRef.current = null;
    setCall((c) => ({ ...c, status: "connecting" }));
    try {
      const stream = await acquireLocalStream(call.kind);
      const pc = createPc1v1(peerId);
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      await pc.setRemoteDescription(offer);
      for (const cand of pendingCandidatesRef.current.splice(0)) {
        try { await pc.addIceCandidate(cand); } catch { /* */ }
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "call:answer", to: peerId, sdp: answer });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to accept call";
      cleanup1v1();
      setCall((c) => ({ ...c, status: "ended", errorMessage: message }));
      send({ type: "call:end", to: peerId });
      window.setTimeout(() => setCall((c) => (c.status === "ended" ? IDLE_CALL : c)), 2500);
    }
  }, [acquireLocalStream, call.kind, call.peerId, call.status, cleanup1v1, createPc1v1, send]);

  const decline = useCallback(() => {
    if (call.status !== "ringing") return;
    send({ type: "call:reject", to: call.peerId });
    cleanup1v1();
    setCall(IDLE_CALL);
  }, [call.peerId, call.status, cleanup1v1, send]);

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

  const revertToCamera = useCallback(() => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const videoTrack = ls.getVideoTracks()[0];
    if (!videoTrack) return;
    const pcs = pcRef.current ? [pcRef.current] : Array.from(groupPcMapRef.current.values());
    for (const pc of pcs) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(videoTrack).catch(() => {});
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      stopScreenStream();
      revertToCamera();
      return;
    }
    try {
      const ss = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia(opts?: DisplayMediaStreamOptions): Promise<MediaStream>;
      }).getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = ss;
      setScreenSharing(true);
      const screenTrack = ss.getVideoTracks()[0];
      if (screenTrack) {
        const pcs = pcRef.current ? [pcRef.current] : Array.from(groupPcMapRef.current.values());
        for (const pc of pcs) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack).catch(() => {});
        }
        screenTrack.addEventListener("ended", () => {
          screenStreamRef.current = null;
          setScreenSharing(false);
          revertToCamera();
        });
      }
    } catch { /* user cancelled */ }
  }, [revertToCamera, screenSharing, stopScreenStream]);

  const createGroupPc = useCallback(
    (peerId: number, peerUsername: string) => {
      const existing = groupPcMapRef.current.get(peerId);
      if (existing) { try { existing.close(); } catch { /* */ } }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      groupPcMapRef.current.set(peerId, pc);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const gc = groupCallRef.current;
        if (gc) send({ type: "call:group:ice", callId: gc.callId, to: peerId, candidate: e.candidate.toJSON() });
      };

      pc.ontrack = (e) => {
        setGroupParticipants((prev) => {
          const next = new Map(prev);
          const existing2 = next.get(peerId);
          const stream = existing2?.stream ?? new MediaStream();
          if (!stream.getTrackById(e.track.id)) stream.addTrack(e.track);
          next.set(peerId, { userId: peerId, username: peerUsername, stream: new MediaStream(stream.getTracks()) });
          return next;
        });
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setGroupCall((gc) => gc ? { ...gc, status: "in-call", startedAt: gc.startedAt ?? Date.now() } : gc);
        } else if (state === "failed" || state === "closed") {
          setGroupParticipants((prev) => { const next = new Map(prev); next.delete(peerId); return next; });
          if (groupPcMapRef.current.get(peerId) === pc) groupPcMapRef.current.delete(peerId);
        }
      };

      return pc;
    },
    [send],
  );

  const startGroupCall = useCallback(
    async (roomId: number, kind: CallKind) => {
      if (!enabled || !myUserId) return;
      if (call.status !== "idle" && call.status !== "ended") return;
      if (groupCall) return;
      const callId = `room-${roomId}-${Date.now()}`;
      const gc: GroupCallState = { callId, roomId, kind, status: "calling", startedAt: null };
      setGroupCall(gc);
      groupCallRef.current = gc;
      try {
        await acquireLocalStream(kind);
        setGroupParticipants(new Map());
        send({ type: "call:group:start", callId, roomId, kind });
      } catch {
        cleanupGroup();
      }
    },
    [acquireLocalStream, call.status, cleanupGroup, enabled, groupCall, myUserId, send],
  );

  const joinGroupCall = useCallback(
    async (invite: GroupInvite) => {
      if (!enabled || !myUserId) return;
      setGroupInvite(null);
      const gc: GroupCallState = { callId: invite.callId, roomId: invite.roomId, kind: invite.kind, status: "calling", startedAt: null };
      setGroupCall(gc);
      groupCallRef.current = gc;
      try {
        await acquireLocalStream(invite.kind);
        send({ type: "call:group:join", callId: invite.callId, roomId: invite.roomId });
      } catch {
        cleanupGroup();
      }
    },
    [acquireLocalStream, cleanupGroup, enabled, myUserId, send],
  );

  const leaveGroupCall = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc) return;
    send({ type: "call:group:leave", callId: gc.callId });
    if (gc.startedAt) {
      const participantUsernames = Array.from(groupPcMapRef.current.entries()).map(([, ]) => "");
      saveCallEvent({
        kind: gc.kind,
        duration: Math.round((Date.now() - gc.startedAt) / 1000),
        participants: [myUsername ?? "", ...participantUsernames].filter(Boolean),
        roomId: gc.roomId,
      });
    }
    cleanupGroup();
  }, [cleanupGroup, myUsername, saveCallEvent, send]);

  const declineGroupInvite = useCallback(() => {
    const inv = groupInvite;
    if (!inv) return;
    send({ type: "call:group:reject", callId: inv.callId });
    setGroupInvite(null);
  }, [groupInvite, send]);

  useEffect(() => {
    if (!enabled) return;
    const off = subscribe((evt) => {
      const t = evt.type;
      if (typeof t !== "string") return;

      if (t.startsWith("call:group:")) {
        const callId = String(evt.callId ?? "");

        if (t === "call:group:invite") {
          if (groupCallRef.current) return;
          setGroupInvite({
            callId,
            roomId: Number(evt.roomId),
            kind: evt.kind === "video" ? "video" : "audio",
            from: Number(evt.from),
            fromUsername: String(evt.fromUsername ?? ""),
          });
          return;
        }

        if (t === "call:group:current") {
          const participants = (evt.participants as Array<{ userId: number; username: string }>) ?? [];
          const gc = groupCallRef.current;
          if (!gc) return;
          const ls = localStreamRef.current;
          for (const p of participants) {
            setGroupParticipants((prev) => {
              const next = new Map(prev);
              if (!next.has(p.userId)) next.set(p.userId, { userId: p.userId, username: p.username, stream: null });
              return next;
            });
            const pc = createGroupPc(p.userId, p.username);
            if (ls) for (const track of ls.getTracks()) {
              if (!pc.getSenders().find((s) => s.track?.id === track.id)) pc.addTrack(track, ls);
            }
            pc.createOffer().then(async (offer) => {
              await pc.setLocalDescription(offer);
              send({ type: "call:group:offer", callId: gc.callId, to: p.userId, sdp: offer });
            }).catch(() => {});
          }
          return;
        }

        if (t === "call:group:peer:join") {
          const gc = groupCallRef.current;
          if (!gc || gc.callId !== callId) return;
          const peerId = Number(evt.peerId);
          const peerUsername = String(evt.peerUsername ?? "");
          setGroupParticipants((prev) => {
            const next = new Map(prev);
            if (!next.has(peerId)) next.set(peerId, { userId: peerId, username: peerUsername, stream: null });
            return next;
          });
          const ls = localStreamRef.current;
          const pc = createGroupPc(peerId, peerUsername);
          if (ls) for (const track of ls.getTracks()) {
            if (!pc.getSenders().find((s) => s.track?.id === track.id)) pc.addTrack(track, ls);
          }
          pc.createOffer().then(async (offer) => {
            await pc.setLocalDescription(offer);
            send({ type: "call:group:offer", callId: gc.callId, to: peerId, sdp: offer });
          }).catch(() => {});
          return;
        }

        if (t === "call:group:offer") {
          const gc = groupCallRef.current;
          if (!gc) return;
          const from = Number(evt.from);
          const fromUsername = String(evt.fromUsername ?? "");
          const sdp = evt.sdp as RTCSessionDescriptionInit;
          const ls = localStreamRef.current;
          setGroupParticipants((prev) => {
            const next = new Map(prev);
            if (!next.has(from)) next.set(from, { userId: from, username: fromUsername, stream: null });
            return next;
          });
          const pc = createGroupPc(from, fromUsername);
          if (ls) for (const track of ls.getTracks()) {
            if (!pc.getSenders().find((s) => s.track?.id === track.id)) pc.addTrack(track, ls);
          }
          const pendingCands = pendingGroupCandidatesRef.current.get(from) ?? [];
          pc.setRemoteDescription(sdp).then(async () => {
            for (const c of pendingCands.splice(0)) {
              try { await pc.addIceCandidate(c); } catch { /* */ }
            }
            pendingGroupCandidatesRef.current.delete(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "call:group:answer", callId: gc.callId, to: from, sdp: answer });
          }).catch(() => {});
          return;
        }

        if (t === "call:group:answer") {
          const from = Number(evt.from);
          const pc = groupPcMapRef.current.get(from);
          if (!pc || !evt.sdp) return;
          const pendingCands = pendingGroupCandidatesRef.current.get(from) ?? [];
          pc.setRemoteDescription(evt.sdp as RTCSessionDescriptionInit).then(async () => {
            for (const c of pendingCands.splice(0)) {
              try { await pc.addIceCandidate(c); } catch { /* */ }
            }
            pendingGroupCandidatesRef.current.delete(from);
          }).catch(() => {});
          return;
        }

        if (t === "call:group:ice") {
          const from = Number(evt.from);
          const candidate = evt.candidate as RTCIceCandidateInit;
          if (!candidate) return;
          const pc = groupPcMapRef.current.get(from);
          if (!pc || !pc.remoteDescription) {
            const arr = pendingGroupCandidatesRef.current.get(from) ?? [];
            arr.push(candidate);
            pendingGroupCandidatesRef.current.set(from, arr);
            return;
          }
          pc.addIceCandidate(candidate).catch(() => {});
          return;
        }

        if (t === "call:group:peer:left") {
          const peerId = Number(evt.peerId);
          const pc = groupPcMapRef.current.get(peerId);
          if (pc) { try { pc.close(); } catch { /* */ } groupPcMapRef.current.delete(peerId); }
          setGroupParticipants((prev) => { const next = new Map(prev); next.delete(peerId); return next; });
          return;
        }
        return;
      }

      if (t.startsWith("call:")) {
        const from = Number(evt.from);
        if (!Number.isFinite(from)) return;
        const fromUsername = String(evt.fromUsername ?? "");

        if (t === "call:offer") {
          const kind: CallKind = evt.kind === "video" ? "video" : "audio";
          const c = callRef.current;
          if ((c.status !== "idle" && c.status !== "ended") && c.peerId !== from) {
            send({ type: "call:reject", to: from, reason: "busy" });
            return;
          }
          pendingOfferRef.current = evt.sdp as RTCSessionDescriptionInit;
          pendingCandidatesRef.current = [];
          setCall({ status: "ringing", peerId: from, peerUsername: fromUsername, kind, isCaller: false, startedAt: null, errorMessage: null });
          return;
        }

        const c = callRef.current;
        if (c.peerId !== from) return;

        if (t === "call:answer") {
          const pc = pcRef.current;
          if (!pc || !evt.sdp) return;
          pc.setRemoteDescription(evt.sdp as RTCSessionDescriptionInit).then(async () => {
            for (const cand of pendingCandidatesRef.current.splice(0)) {
              try { await pc.addIceCandidate(cand); } catch { /* */ }
            }
            setCall((c2) => c2.status === "calling" ? { ...c2, status: "connecting" } : c2);
          }).catch(() => endLocal("Failed to negotiate", true));
        } else if (t === "call:ice") {
          const pc = pcRef.current;
          if (!evt.candidate) return;
          if (!pc || !pc.remoteDescription) {
            pendingCandidatesRef.current.push(evt.candidate as RTCIceCandidateInit);
            return;
          }
          pc.addIceCandidate(evt.candidate as RTCIceCandidateInit).catch(() => {});
        } else if (t === "call:reject") {
          cleanup1v1();
          setCall((c2) => ({ ...c2, status: "ended", errorMessage: evt.reason === "busy" ? "User is busy" : "Call declined" }));
          window.setTimeout(() => setCall((c2) => (c2.status === "ended" ? IDLE_CALL : c2)), 2000);
        } else if (t === "call:end") {
          const c2 = callRef.current;
          if (c2.startedAt && c2.peerId) {
            saveCallEvent({
              kind: c2.kind,
              duration: Math.round((Date.now() - c2.startedAt) / 1000),
              participants: [myUsername ?? "", c2.peerUsername].filter(Boolean),
              peerId: c2.peerId,
            });
          }
          cleanup1v1();
          setCall((c3) => ({ ...c3, status: "ended" }));
          window.setTimeout(() => setCall((c3) => (c3.status === "ended" ? IDLE_CALL : c3)), 800);
        }
      }
    });
    return off;
  }, [cleanup1v1, createGroupPc, enabled, endLocal, myUsername, saveCallEvent, send, subscribe]);

  useEffect(() => () => { cleanup1v1(); cleanupGroup(); }, [cleanup1v1, cleanupGroup]);

  return {
    call,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    screenSharing,
    startCall,
    accept,
    decline,
    hangUp,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    groupCall,
    groupInvite,
    groupParticipants,
    startGroupCall,
    joinGroupCall,
    leaveGroupCall,
    declineGroupInvite,
  };
}
