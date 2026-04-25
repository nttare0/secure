import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { idParamSchema, messageContentSchema, searchQuerySchema } from "../lib/validation";

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

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

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
}

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
  };
}

router.get("/", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.username,
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
      `SELECT id, username FROM users
       WHERE id != ? AND username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 10`,
    )
    .all(userId, `%${safe}%`);
  res.json(rows);
});

router.get("/:userId/messages", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const otherId = parseId(req.params.userId);
  if (!otherId) return res.status(400).json({ error: "Invalid user id" });
  const other = db.prepare("SELECT id, username FROM users WHERE id = ?").get(otherId) as
    | { id: number; username: string }
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
      `SELECT d.id, d.sender_id, d.recipient_id, u.username AS sender_name, d.content,
              d.attachment_filename, d.attachment_original_name,
              d.attachment_mime_type, d.attachment_size, d.created_at
       FROM dms d JOIN users u ON u.id = d.sender_id
       WHERE ${where}
       ORDER BY d.id DESC
       LIMIT ?`,
    )
    .all(...params) as DmRow[];
  res.json({ peer: other, messages: rows.map(serialize) });
});

router.post(
  "/:userId/messages",
  requireAuth,
  writeLimiter,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large (max 10MB)" });
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
    const now = Date.now();
    const info = db
      .prepare(
        `INSERT INTO dms (sender_id, recipient_id, content, attachment_filename,
                          attachment_original_name, attachment_mime_type, attachment_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    const row = db
      .prepare(
        `SELECT d.id, d.sender_id, d.recipient_id, u.username AS sender_name, d.content,
                d.attachment_filename, d.attachment_original_name,
                d.attachment_mime_type, d.attachment_size, d.created_at
         FROM dms d JOIN users u ON u.id = d.sender_id
         WHERE d.id = ?`,
      )
      .get(Number(info.lastInsertRowid)) as DmRow;
    res.json(serialize(row));
  },
);

export default router;
