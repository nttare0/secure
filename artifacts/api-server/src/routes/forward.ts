import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { forwardSchema, validateBody } from "../lib/validation";
import { emitToRoom, emitToDmPair } from "../lib/realtime";

const router: IRouter = Router();

interface SourceMessage {
  user_id: number;
  username: string;
  content: string | null;
  attachment_filename: string | null;
  attachment_original_name: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  forwarded_from_username: string | null;
}

function loadRoomSource(messageId: number, userId: number): SourceMessage | null {
  const row = db
    .prepare(
      `SELECT m.user_id, u.username, m.content,
              m.attachment_filename, m.attachment_original_name,
              m.attachment_mime_type, m.attachment_size, m.forwarded_from_username,
              m.room_id
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
    )
    .get(messageId) as (SourceMessage & { room_id: number }) | undefined;
  if (!row) return null;
  const member = db
    .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .get(row.room_id, userId);
  if (!member) return null;
  return row;
}

function loadDmSource(messageId: number, userId: number): SourceMessage | null {
  const row = db
    .prepare(
      `SELECT d.sender_id AS user_id, u.username, d.content,
              d.attachment_filename, d.attachment_original_name,
              d.attachment_mime_type, d.attachment_size, d.forwarded_from_username,
              d.sender_id, d.recipient_id
       FROM dms d JOIN users u ON u.id = d.sender_id
       WHERE d.id = ?`,
    )
    .get(messageId) as
    | (SourceMessage & { sender_id: number; recipient_id: number })
    | undefined;
  if (!row) return null;
  if (row.sender_id !== userId && row.recipient_id !== userId) return null;
  return row;
}

router.post(
  "/forward",
  requireAuth,
  writeLimiter,
  validateBody(forwardSchema),
  (req, res) => {
    const userId = req.session.userId!;
    const { source, targets } = (req as any).validated as {
      source: { type: "room" | "dm"; messageId: number };
      targets: Array<{ type: "room" | "dm"; id: number }>;
    };

    const src =
      source.type === "room"
        ? loadRoomSource(source.messageId, userId)
        : loadDmSource(source.messageId, userId);
    if (!src) {
      return res.status(404).json({ error: "Source message not found or no access" });
    }
    if (!src.content && !src.attachment_filename) {
      return res.status(400).json({ error: "Nothing to forward" });
    }

    // The "forwarded from" credit always points back to the original author
    const originalAuthor = src.forwarded_from_username ?? src.username;
    const now = Date.now();
    const delivered: Array<{ type: "room" | "dm"; id: number; ok: boolean; error?: string }> = [];

    for (const t of targets) {
      try {
        if (t.type === "room") {
          const member = db
            .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
            .get(t.id, userId);
          if (!member) {
            delivered.push({ type: t.type, id: t.id, ok: false, error: "Not a member" });
            continue;
          }
          const info = db.prepare(
            `INSERT INTO messages (room_id, user_id, content, attachment_filename,
                                   attachment_original_name, attachment_mime_type, attachment_size,
                                   created_at, forwarded_from_username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            t.id,
            userId,
            src.content,
            src.attachment_filename,
            src.attachment_original_name,
            src.attachment_mime_type,
            src.attachment_size,
            now,
            originalAuthor,
          );
          emitToRoom(t.id, {
            type: "room:message:new",
            roomId: t.id,
            messageId: Number(info.lastInsertRowid),
          });
        } else {
          if (t.id === userId) {
            delivered.push({ type: t.type, id: t.id, ok: false, error: "Cannot DM yourself" });
            continue;
          }
          const exists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(t.id);
          if (!exists) {
            delivered.push({ type: t.type, id: t.id, ok: false, error: "User not found" });
            continue;
          }
          const info = db.prepare(
            `INSERT INTO dms (sender_id, recipient_id, content, attachment_filename,
                              attachment_original_name, attachment_mime_type, attachment_size,
                              created_at, forwarded_from_username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            userId,
            t.id,
            src.content,
            src.attachment_filename,
            src.attachment_original_name,
            src.attachment_mime_type,
            src.attachment_size,
            now,
            originalAuthor,
          );
          emitToDmPair(userId, t.id, {
            type: "dm:message:new",
            senderId: userId,
            recipientId: t.id,
            messageId: Number(info.lastInsertRowid),
          });
        }
        delivered.push({ type: t.type, id: t.id, ok: true });
      } catch (err) {
        delivered.push({
          type: t.type,
          id: t.id,
          ok: false,
          error: err instanceof Error ? err.message : "Forward failed",
        });
      }
    }

    res.json({ delivered });
  },
);

export default router;
