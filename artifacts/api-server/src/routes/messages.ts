import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { editMessageSchema, idParamSchema, messageContentSchema, validateBody } from "../lib/validation";
import { maybeUnlinkAttachment } from "../lib/attachments";
import { emitToRoom } from "../lib/realtime";

const router: IRouter = Router();

function parseId(value: unknown): number | null {
  const result = idParamSchema.safeParse(String(value));
  return result.success ? result.data : null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16).replace(/[^A-Za-z0-9.]/g, "");
    const id = crypto.randomBytes(16).toString("hex");
    cb(null, id + ext);
  },
});

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function ensureMember(roomId: number, userId: number): boolean {
  return !!db
    .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .get(roomId, userId);
}

interface MessageRow {
  id: number;
  user_id: number;
  username: string;
  content: string | null;
  attachment_filename: string | null;
  attachment_original_name: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  created_at: number;
  edited_at: number | null;
  reply_to_id: number | null;
  forwarded_from_username: string | null;
  reply_username: string | null;
  reply_content: string | null;
  reply_attachment_name: string | null;
  message_type: string | null;
  call_kind: string | null;
  call_duration: number | null;
  call_participants: string | null;
}

const SELECT_MESSAGE_COLS = `
  m.id, m.user_id, u.username, m.content,
  m.attachment_filename, m.attachment_original_name,
  m.attachment_mime_type, m.attachment_size, m.created_at,
  m.edited_at, m.reply_to_id, m.forwarded_from_username,
  ru.username AS reply_username,
  rm.content AS reply_content,
  rm.attachment_original_name AS reply_attachment_name,
  m.message_type, m.call_kind, m.call_duration, m.call_participants
`;

const FROM_MESSAGE_JOINS = `
  FROM messages m
  JOIN users u ON u.id = m.user_id
  LEFT JOIN messages rm ON rm.id = m.reply_to_id
  LEFT JOIN users ru ON ru.id = rm.user_id
`;

function tryParseArr(s: string | null): string[] {
  if (!s) return [];
  try { const p = JSON.parse(s); return Array.isArray(p) ? (p as string[]) : []; } catch { return []; }
}

function serialize(m: MessageRow) {
  return {
    id: m.id,
    userId: m.user_id,
    username: m.username,
    content: m.content,
    attachment: m.attachment_filename
      ? {
          filename: m.attachment_filename,
          originalName: m.attachment_original_name,
          mimeType: m.attachment_mime_type,
          size: m.attachment_size,
        }
      : null,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    forwardedFrom: m.forwarded_from_username,
    replyTo: m.reply_to_id
      ? {
          id: m.reply_to_id,
          username: m.reply_username,
          content: m.reply_content,
          attachmentName: m.reply_attachment_name,
        }
      : null,
    messageType: m.message_type ?? "message",
    callEvent: m.message_type === "call"
      ? { kind: m.call_kind ?? "audio", duration: m.call_duration ?? null, participants: tryParseArr(m.call_participants) }
      : null,
  };
}

router.get("/:id/messages", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const roomId = parseId(req.params.id);
  if (!roomId) return res.status(400).json({ error: "Invalid room id" });
  if (!ensureMember(roomId, userId)) return res.status(403).json({ error: "Not a member" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const before = req.query.before ? Number(req.query.before) : null;
  const params: (number | null)[] = [roomId];
  let where = "m.room_id = ?";
  if (before && Number.isInteger(before) && before > 0) {
    where += " AND m.id < ?";
    params.push(before);
  }
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT ${SELECT_MESSAGE_COLS}
       ${FROM_MESSAGE_JOINS}
       WHERE ${where}
       ORDER BY m.id DESC
       LIMIT ?`,
    )
    .all(...params) as MessageRow[];
  res.json(rows.map(serialize));
});

router.post(
  "/:id/messages",
  requireAuth,
  writeLimiter,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large (max 100MB)" });
        }
        return res.status(400).json({ error: err.message ?? "Upload failed" });
      }
      next();
    });
  },
  (req, res) => {
    const userId = req.session.userId!;
    const roomId = parseId(req.params.id);
    if (!roomId) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Invalid room id" });
    }
    if (!ensureMember(roomId, userId)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "Not a member" });
    }
    const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
    const parsed = messageContentSchema.safeParse(rawContent);
    if (!parsed.success) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Message too long (max 4000 chars)" });
    }
    const content = parsed.data.trim();
    const file = req.file;
    if (!content && !file) {
      return res.status(400).json({ error: "Message must have text or a file" });
    }

    let replyToId: number | null = null;
    if (req.body?.replyToId) {
      const rid = Number(req.body.replyToId);
      if (Number.isInteger(rid) && rid > 0) {
        const exists = db
          .prepare("SELECT 1 FROM messages WHERE id = ? AND room_id = ?")
          .get(rid, roomId);
        if (exists) replyToId = rid;
      }
    }

    const now = Date.now();
    const info = db
      .prepare(
        `INSERT INTO messages (room_id, user_id, content, attachment_filename,
                               attachment_original_name, attachment_mime_type, attachment_size,
                               created_at, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        roomId,
        userId,
        content || null,
        file?.filename ?? null,
        file?.originalname ?? null,
        file?.mimetype ?? null,
        file?.size ?? null,
        now,
        replyToId,
      );
    const row = db
      .prepare(`SELECT ${SELECT_MESSAGE_COLS} ${FROM_MESSAGE_JOINS} WHERE m.id = ?`)
      .get(Number(info.lastInsertRowid)) as MessageRow;
    const payload = serialize(row);
    emitToRoom(roomId, { type: "room:message:new", roomId, message: payload });
    res.json(payload);
  },
);

router.patch(
  "/:id/messages/:msgId",
  requireAuth,
  writeLimiter,
  validateBody(editMessageSchema),
  (req, res) => {
    const userId = req.session.userId!;
    const roomId = parseId(req.params.id);
    const msgId = parseId(req.params.msgId);
    if (!roomId || !msgId) return res.status(400).json({ error: "Invalid id" });
    const row = db
      .prepare("SELECT user_id, room_id FROM messages WHERE id = ?")
      .get(msgId) as { user_id: number; room_id: number } | undefined;
    if (!row || row.room_id !== roomId) return res.status(404).json({ error: "Not found" });
    if (row.user_id !== userId) return res.status(403).json({ error: "You can only edit your own messages" });
    const { content } = (req as any).validated as { content: string };
    db.prepare("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?").run(
      content,
      Date.now(),
      msgId,
    );
    const updated = db
      .prepare(`SELECT ${SELECT_MESSAGE_COLS} ${FROM_MESSAGE_JOINS} WHERE m.id = ?`)
      .get(msgId) as MessageRow;
    const payload = serialize(updated);
    emitToRoom(roomId, { type: "room:message:update", roomId, message: payload });
    res.json(payload);
  },
);

router.delete("/:id/messages/:msgId", requireAuth, writeLimiter, (req, res) => {
  const userId = req.session.userId!;
  const roomId = parseId(req.params.id);
  const msgId = parseId(req.params.msgId);
  if (!roomId || !msgId) return res.status(400).json({ error: "Invalid id" });
  const row = db
    .prepare(
      "SELECT user_id, room_id, attachment_filename FROM messages WHERE id = ?",
    )
    .get(msgId) as
    | { user_id: number; room_id: number; attachment_filename: string | null }
    | undefined;
  if (!row || row.room_id !== roomId) return res.status(404).json({ error: "Not found" });
  if (row.user_id !== userId) {
    // Allow room owner to delete any message in their room
    const owner = db
      .prepare("SELECT owner_id FROM rooms WHERE id = ?")
      .get(roomId) as { owner_id: number } | undefined;
    if (!owner || owner.owner_id !== userId) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }
  }
  db.prepare("DELETE FROM messages WHERE id = ?").run(msgId);
  maybeUnlinkAttachment(row.attachment_filename);
  emitToRoom(roomId, { type: "room:message:delete", roomId, messageId: msgId });
  res.json({ ok: true });
});

export default router;
