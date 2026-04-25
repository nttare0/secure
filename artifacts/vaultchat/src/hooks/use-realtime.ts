import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeOptions {
  enabled: boolean;
  myUserId?: number;
}

export interface TypingPeer {
  scopeKey: string; // "room:<id>" or "dm:<peerId>"
  userId: number;
  username: string;
  at: number;
}

const TYPING_TTL = 4000;

export function useRealtime({ enabled, myUserId }: RealtimeOptions) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<TypingPeer[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const reconnectAttempts = useRef(0);

  // GC stale typers
  useEffect(() => {
    const t = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const filtered = prev.filter((p) => now - p.at < TYPING_TTL);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const url = `${proto}//${window.location.host}${base}/api/realtime`;
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts.current = 0;
        setConnected(true);
      };
      socket.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };
      socket.onerror = () => {
        // onclose will follow
      };
      socket.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as { type: string; [k: string]: any };
          handleEvent(evt);
        } catch {
          /* ignore */
        }
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const attempts = reconnectAttempts.current++;
      const delay = Math.min(15000, 500 * Math.pow(2, Math.min(attempts, 5)));
      reconnectTimer = setTimeout(connect, delay);
    };

    const handleEvent = (evt: { type: string; [k: string]: any }) => {
      switch (evt.type) {
        case "ready":
          break;
        case "room:message:new":
        case "room:message:update":
        case "room:message:delete": {
          const roomId = evt.roomId;
          qc.invalidateQueries({ queryKey: ["rooms", roomId, "messages"] });
          qc.invalidateQueries({ queryKey: ["rooms"] });
          break;
        }
        case "dm:message:new":
        case "dm:message:update":
        case "dm:message:delete": {
          const peerId = evt.senderId === myUserId ? evt.recipientId : evt.senderId;
          qc.invalidateQueries({ queryKey: ["dms", peerId, "messages"] });
          qc.invalidateQueries({ queryKey: ["dms"] });
          break;
        }
        case "presence:update": {
          const userId = Number(evt.userId);
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (evt.online) next.add(userId);
            else next.delete(userId);
            return next;
          });
          qc.invalidateQueries({ queryKey: ["dms"] });
          break;
        }
        case "user:profile": {
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["dms"] });
          if (evt.userId === myUserId) {
            qc.invalidateQueries({ queryKey: ["auth", "me"] });
          }
          break;
        }
        case "typing": {
          const scope = evt.scope as { type: string; id?: number; peerId?: number };
          if (Number(evt.userId) === myUserId) return;
          let scopeKey: string;
          if (scope.type === "room") scopeKey = `room:${scope.id}`;
          else scopeKey = `dm:${scope.peerId}`;
          setTyping((prev) => {
            const filtered = prev.filter(
              (p) => !(p.scopeKey === scopeKey && p.userId === evt.userId),
            );
            return [
              ...filtered,
              { scopeKey, userId: evt.userId, username: evt.username, at: Date.now() },
            ];
          });
          break;
        }
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState <= 1) socket.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled, myUserId, qc]);

  const sendTyping = useCallback(
    (scope: { type: "room"; id: number } | { type: "dm"; id: number }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "typing", scope }));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { connected, typing, onlineUsers, sendTyping };
}

export function getTypingFor(
  typing: TypingPeer[],
  scope: { type: "room"; id: number } | { type: "dm"; id: number },
): TypingPeer[] {
  const key = scope.type === "room" ? `room:${scope.id}` : `dm:${scope.id}`;
  const now = Date.now();
  return typing.filter((t) => t.scopeKey === key && now - t.at < TYPING_TTL);
}
