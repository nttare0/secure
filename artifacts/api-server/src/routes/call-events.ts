import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { emitToRoom, emitToDmPair } from "../lib/realtime";

const router: IRouter = Router();

interface CallEventBody {
  kind?: unknown;
  duration?: unknown;
  participants?: unknown;
  peerId?: unknown;
  roomId?: unknown;
  isGroup?: unknown;
}

router.post("/", requireAuth, writeLimiter, (req, res) => {
  const userId = req.session.userId!;
  const body = (req.body ?? {}) as CallEventBody;
  const kind = body.kind === "video" ? "video" : "audio";
  const duration = Number.isFinite(Number(body.duration)) && Number(body.duration) >= 0
    ? Math.round(Number(body.duration))
    : null;
  const participants = Array.isArray(body.participants)
    ? JSON.stringify((body.participants as unknown[]).map(String).slice(0, 20))
    : "[]";
  const isGroup = !!body.isGroup;
  const now = Date.now();

  const userRow = db
    .prepare("SELECT username FROM users WHERE id = ?")
    .get(userId) as { username: string } | undefined;
  if (!userRow) return res.status(401).json({ error: "Not found" });

  if (body.roomId) {
    const roomId = Number(body.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0)
      return res.status(400).json({ error: "Invalid roomId" });
    const isMember = db
      .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
      .get(roomId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const info = db
      .prepare(
        `INSERT INTO messages (room_id, user_id, content, created_at, message_type, call_kind, call_duration, call_participants)
         VALUES (?, ?, NULL, ?, 'call', ?, ?, ?)`,
      )
      .run(roomId, userId, now, kind, duration, participants);

    const row = db
      .prepare(
        `SELECT m.id, m.user_id, u.username, m.content, m.created_at, m.edited_at,
                m.reply_to_id, m.forwarded_from_username, m.message_type,
                m.call_kind, m.call_duration, m.call_participants,
                NULL AS attachment_filename, NULL AS attachment_original_name,
                NULL AS attachment_mime_type, NULL AS attachment_size,
                NULL AS reply_username, NULL AS reply_content, NULL AS reply_attachment_name
         FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
      )
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;

    const payload = serializeMsg(row);
    emitToRoom(roomId, { type: "room:message:new", roomId, message: payload });
    return res.json(payload);
  }

  if (body.peerId) {
    const peerId = Number(body.peerId);
    if (!Number.isFinite(peerId) || peerId <= 0)
      return res.status(400).json({ error: "Invalid peerId" });
    const peerExists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(peerId);
    if (!peerExists) return res.status(404).json({ error: "Peer not found" });

    const info = db
      .prepare(
        `INSERT INTO dms (sender_id, recipient_id, content, created_at, message_type, call_kind, call_duration, call_participants)
         VALUES (?, ?, NULL, ?, 'call', ?, ?, ?)`,
      )
      .run(userId, peerId, now, kind, duration, participants);

    const row = db
      .prepare(
        `SELECT d.id, d.sender_id AS user_id, u.username, d.content, d.created_at, d.edited_at,
                d.reply_to_id, d.forwarded_from_username, d.message_type,
                d.call_kind, d.call_duration, d.call_participants,
                NULL AS attachment_filename, NULL AS attachment_original_name,
                NULL AS attachment_mime_type, NULL AS attachment_size,
                NULL AS reply_username, NULL AS reply_content, NULL AS reply_attachment_name,
                d.sender_id, d.recipient_id
         FROM dms d JOIN users u ON u.id = d.sender_id WHERE d.id = ?`,
      )
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;

    const payload = { ...serializeMsg(row), senderId: userId, recipientId: peerId };
    emitToDmPair(userId, peerId, { type: "dm:new", message: payload });
    return res.json(payload);
  }

  return res.status(400).json({ error: "Provide roomId or peerId" });
});

function serializeMsg(m: Record<string, unknown>) {
  return {
    id: m.id,
    userId: m.user_id,
    username: m.username,
    content: null,
    attachment: null,
    createdAt: m.created_at,
    editedAt: m.edited_at ?? null,
    forwardedFrom: m.forwarded_from_username ?? null,
    replyTo: null,
    messageType: m.message_type ?? "message",
    callEvent: m.message_type === "call"
      ? {
          kind: m.call_kind ?? "audio",
          duration: m.call_duration ?? null,
          participants: tryParse(m.call_participants as string | null),
        }
      : null,
  };
}

function tryParse(s: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export default router;
