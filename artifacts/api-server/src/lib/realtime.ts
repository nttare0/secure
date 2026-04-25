import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { parse as parseUrl } from "node:url";
import cookie from "cookie-parser";
import session from "express-session";
import { SqliteStore } from "./session-store";
import { db } from "./db";
import { logger } from "./logger";

interface AuthedSocket {
  ws: WebSocket;
  userId: number;
  username: string;
}

const sockets = new Map<number, Set<AuthedSocket>>();
let wss: WebSocketServer | null = null;
let store: SqliteStore | null = null;

const HEARTBEAT_MS = 30_000;

export interface RealtimeEvent {
  type: string;
  [k: string]: unknown;
}

function add(userId: number, s: AuthedSocket): void {
  let set = sockets.get(userId);
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
  }
  set.add(s);
}

function remove(userId: number, s: AuthedSocket): void {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(s);
  if (set.size === 0) sockets.delete(userId);
}

function send(s: AuthedSocket, evt: RealtimeEvent): void {
  if (s.ws.readyState !== s.ws.OPEN) return;
  try {
    s.ws.send(JSON.stringify(evt));
  } catch (err) {
    logger.warn({ err }, "ws send failed");
  }
}

export function emitToUser(userId: number, evt: RealtimeEvent): void {
  const set = sockets.get(userId);
  if (!set) return;
  for (const s of set) send(s, evt);
}

export function emitToUsers(userIds: number[], evt: RealtimeEvent): void {
  const seen = new Set<number>();
  for (const id of userIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    emitToUser(id, evt);
  }
}

export function emitToAll(evt: RealtimeEvent): void {
  for (const set of sockets.values()) {
    for (const s of set) send(s, evt);
  }
}

const roomMembersStmt = db.prepare(
  "SELECT user_id AS userId FROM room_members WHERE room_id = ?",
);
export function getRoomMemberIds(roomId: number): number[] {
  return (roomMembersStmt.all(roomId) as Array<{ userId: number }>).map((r) => r.userId);
}

export function emitToRoom(roomId: number, evt: RealtimeEvent): void {
  emitToUsers(getRoomMemberIds(roomId), evt);
}

export function emitToDmPair(a: number, b: number, evt: RealtimeEvent): void {
  emitToUsers([a, b], evt);
}

export function isUserOnline(userId: number): boolean {
  const set = sockets.get(userId);
  return !!set && set.size > 0;
}

function parseSidFromCookies(req: IncomingMessage, secret: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parsed = cookie.signedCookies(parseCookieHeader(raw), secret);
  if (parsed["vc.sid"] && typeof parsed["vc.sid"] === "string") return parsed["vc.sid"];
  return null;
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = header.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function loadSession(sid: string): Promise<{ userId: number } | null> {
  return new Promise((resolve) => {
    if (!store) return resolve(null);
    store.get(sid, (err, sess) => {
      if (err || !sess || !(sess as session.SessionData).userId) return resolve(null);
      resolve({ userId: (sess as session.SessionData).userId as number });
    });
  });
}

export function attachRealtime(httpServer: HttpServer, sessionSecret: string): void {
  store = new SqliteStore();
  wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = parseUrl(req.url || "", true);
    if (!url.pathname || !url.pathname.endsWith("/api/realtime")) {
      socket.destroy();
      return;
    }
    const rawSid = parseSidFromCookies(req, sessionSecret);
    if (!rawSid) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    void loadSession(rawSid).then((sess) => {
      if (!sess) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      const userId = sess.userId;
      const userRow = db
        .prepare("SELECT username, is_disabled FROM users WHERE id = ?")
        .get(userId) as { username: string; is_disabled: number } | undefined;
      if (!userRow || userRow.is_disabled) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      wss!.handleUpgrade(req, socket, head, (ws) => {
        const authed: AuthedSocket = { ws, userId, username: userRow.username };
        add(userId, authed);
        const wasFirst = (sockets.get(userId)?.size ?? 0) === 1;
        if (wasFirst) {
          db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(
            Date.now(),
            userId,
          );
          emitToAll({ type: "presence:update", userId, online: true, lastSeen: Date.now() });
        }

        ws.on("message", (raw) => {
          try {
            const data = JSON.parse(raw.toString()) as RealtimeEvent;
            handleClientMessage(authed, data);
          } catch {
            /* ignore */
          }
        });

        let alive = true;
        ws.on("pong", () => {
          alive = true;
        });
        const pinger = setInterval(() => {
          if (!alive) {
            ws.terminate();
            clearInterval(pinger);
            return;
          }
          alive = false;
          try {
            ws.ping();
          } catch {
            /* ignore */
          }
        }, HEARTBEAT_MS);

        ws.on("close", () => {
          clearInterval(pinger);
          remove(userId, authed);
          const lastSeen = Date.now();
          db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(lastSeen, userId);
          if (!sockets.has(userId)) {
            emitToAll({ type: "presence:update", userId, online: false, lastSeen });
          }
        });

        send(authed, { type: "ready", userId, username: userRow.username });
      });
    });
  });

  logger.info("Realtime WebSocket attached at /api/realtime");
}

function handleClientMessage(s: AuthedSocket, evt: RealtimeEvent): void {
  if (evt.type === "typing") {
    const scope = (evt.scope as { type: string; id: number }) || null;
    if (!scope) return;
    if (scope.type === "room") {
      const memberIds = getRoomMemberIds(Number(scope.id)).filter((id) => id !== s.userId);
      emitToUsers(memberIds, {
        type: "typing",
        scope: { type: "room", id: Number(scope.id) },
        userId: s.userId,
        username: s.username,
        at: Date.now(),
      });
    } else if (scope.type === "dm") {
      emitToUser(Number(scope.id), {
        type: "typing",
        scope: { type: "dm", peerId: s.userId },
        userId: s.userId,
        username: s.username,
        at: Date.now(),
      });
    }
  }
}
