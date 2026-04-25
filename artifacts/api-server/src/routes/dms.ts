import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import {
  editMessageSchema,
  idParamSchema,
  messageContentSchema,
  searchQuerySchema,
  validateBody,
} from "../lib/validation";
import { maybeUnlinkAttachment } from "../lib/attachments";

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
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

interface DmRow {
  id: number;
  sender_id: number;
  recipient_id: number;
  sender_name: string;
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
}

const SELECT_DM_COLS = `
  d.id, d.sender_id, d.recipient_id, u.username AS sender_name, d.content,
  d.attachment_filename, d.attachment_original_name,
  d.attachment_mime_type, d.attachment_size, d.created_at,
  d.edited_at, d.reply_to_id, d.forwarded_from_username,
  ru.username AS reply_username,
  rd.content AS reply_content,
  rd.attachment_original_name AS reply_attachment_name
`;

const FROM_DM_JOINS = `
  FROM dms d
  JOIN users u ON u.id = d.sender_id
  LEFT JOIN dms rd ON rd.id = d.reply_to_id
  LEFT JOIN users ru ON ru.id = rd.sender_id
`;

function serialize(m: DmRow) {
  return {
    id: m.id,
    userId: m.sender_id,
    senderId: m.sender_id,
    recipientId: m.recipient_id,
    username: m.sender_name,
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
  };
}

router.get("/", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.username, u.last_seen_at AS lastSeen,
              (SELECT MAX(created_at) FROM dms
                WHERE (sender_id = ? AND recipient_id = u.id)
                   OR (sender_id = u.id AND recipient_id = ?)) AS lastMessageAt,
              (SELECT content FROM dms
                WHERE (sender_id = ? AND recipient_id = u.id)
                   OR (sender_id = u.id AND recipient_id = ?)
                ORDER BY id DESC LIMIT 1) AS lastMessage
       FROM users u
       WHERE u.id != ?
         AND EXISTS (
           SELECT 1 FROM dms d
           WHERE (d.sender_id = ? AND d.recipient_id = u.id)
              OR (d.sender_id = u.id AND d.recipient_id = ?)
         )
       ORDER BY lastMessageAt DESC`,
    )
    .all(userId, userId, userId, userId, userId, userId, userId);
  res.json(rows);
});

router.get("/users/search", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const parsed = searchQuerySchema.safeParse({ q: req.query.q });
  if (!parsed.success) return res.json([]);
  const q = parsed.data.q;
  const safe = q.replace(/[%_\\]/g, (c) => "\\" + c);
  const rows = db
    .prepare(
      `SELECT id, username, last_seen_at AS lastSeen FROM users
       WHERE id != ? AND username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 10`,
    )
    .all(userId, `%${safe}%`);
  res.json(rows);
});

router.get("/:userId/messages", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const otherId = parseId(req.params.userId);
  if (!otherId) return res.status(400).json({ error: "Invalid user id" });
  const other = db
    .prepare("SELECT id, username, last_seen_at FROM users WHERE id = ?")
    .get(otherId) as
    | { id: number; username: string; last_seen_at: number | null }
    | undefined;
  if (!other) return res.status(404).json({ error: "User not found" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const before = req.query.before ? Number(req.query.before) : null;
  const params: (number | null)[] = [userId, otherId, otherId, userId];
  let where = "((d.sender_id = ? AND d.recipient_id = ?) OR (d.sender_id = ? AND d.recipient_id = ?))";
  if (before && Number.isInteger(before) && before > 0) {
    where += " AND d.id < ?";
    params.push(before);
  }
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT ${SELECT_DM_COLS}
       ${FROM_DM_JOINS}
       WHERE ${where}
       ORDER BY d.id DESC
       LIMIT ?`,
    )
    .all(...params) as DmRow[];
  res.json({
    peer: { id: other.id, username: other.username, lastSeen: other.last_seen_at },
    messages: rows.map(serialize),
  });
});

router.post(
  "/:userId/messages",
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
    const otherId = parseId(req.params.userId);
    if (!otherId || otherId === userId) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Invalid recipient" });
    }
    const exists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(otherId);
    if (!exists) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "User not found" });
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
          .prepare(
            "SELECT 1 FROM dms WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))",
          )
          .get(rid, userId, otherId, otherId, userId);
        if (exists) replyToId = rid;
      }
    }

    const now = Date.now();
    const info = db
      .prepare(
        `INSERT INTO dms (sender_id, recipient_id, content, attachment_filename,
                          attachment_original_name, attachment_mime_type, attachment_size,
                          created_at, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        otherId,
        content || null,
        file?.filename ?? null,
        file?.originalname ?? null,
        file?.mimetype ?? null,
        file?.size ?? null,
        now,
        replyToId,
      );
    const row = db
      .prepare(`SELECT ${SELECT_DM_COLS} ${FROM_DM_JOINS} WHERE d.id = ?`)
      .get(Number(info.lastInsertRowid)) as DmRow;
    res.json(serialize(row));
  },
);

router.patch(
  "/:userId/messages/:msgId",
  requireAuth,
  writeLimiter,
  validateBody(editMessageSchema),
  (req, res) => {
    const userId = req.session.userId!;
    const otherId = parseId(req.params.userId);
    const msgId = parseId(req.params.msgId);
    if (!otherId || !msgId) return res.status(400).json({ error: "Invalid id" });
    const row = db
      .prepare("SELECT sender_id, recipient_id FROM dms WHERE id = ?")
      .get(msgId) as { sender_id: number; recipient_id: number } | undefined;
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.sender_id !== userId) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }
    const inThread =
      (row.sender_id === userId && row.recipient_id === otherId) ||
      (row.sender_id === otherId && row.recipient_id === userId);
    if (!inThread) return res.status(404).json({ error: "Not found" });
    const { content } = (req as any).validated as { content: string };
    db.prepare("UPDATE dms SET content = ?, edited_at = ? WHERE id = ?").run(
      content,
      Date.now(),
      msgId,
    );
    const updated = db
      .prepare(`SELECT ${SELECT_DM_COLS} ${FROM_DM_JOINS} WHERE d.id = ?`)
      .get(msgId) as DmRow;
    res.json(serialize(updated));
  },
);

router.delete("/:userId/messages/:msgId", requireAuth, writeLimiter, (req, res) => {
  const userId = req.session.userId!;
  const otherId = parseId(req.params.userId);
  const msgId = parseId(req.params.msgId);
  if (!otherId || !msgId) return res.status(400).json({ error: "Invalid id" });
  const row = db
    .prepare(
      "SELECT sender_id, recipient_id, attachment_filename FROM dms WHERE id = ?",
    )
    .get(msgId) as
    | { sender_id: number; recipient_id: number; attachment_filename: string | null }
    | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.sender_id !== userId) {
    return res.status(403).json({ error: "You can only delete your own messages" });
  }
  const inThread =
    (row.sender_id === userId && row.recipient_id === otherId) ||
    (row.sender_id === otherId && row.recipient_id === userId);
  if (!inThread) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM dms WHERE id = ?").run(msgId);
  maybeUnlinkAttachment(row.attachment_filename);
  res.json({ ok: true });
});

export default router;
