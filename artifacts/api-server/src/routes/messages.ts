import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { idParamSchema, messageContentSchema } from "../lib/validation";

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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
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
      `SELECT m.id, m.user_id, u.username, m.content,
              m.attachment_filename, m.attachment_original_name,
              m.attachment_mime_type, m.attachment_size, m.created_at
       FROM messages m JOIN users u ON u.id = m.user_id
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
          return res.status(413).json({ error: "File too large (max 10MB)" });
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
    const now = Date.now();
    const info = db
      .prepare(
        `INSERT INTO messages (room_id, user_id, content, attachment_filename,
                               attachment_original_name, attachment_mime_type, attachment_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    const row = db
      .prepare(
        `SELECT m.id, m.user_id, u.username, m.content,
                m.attachment_filename, m.attachment_original_name,
                m.attachment_mime_type, m.attachment_size, m.created_at
         FROM messages m JOIN users u ON u.id = m.user_id
         WHERE m.id = ?`,
      )
      .get(Number(info.lastInsertRowid)) as MessageRow;
    res.json(serialize(row));
  },
);

export default router;
