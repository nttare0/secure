import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { filenameSchema } from "../lib/validation";

const router: IRouter = Router();

router.get("/:filename", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const rawName = String(req.params.filename || "");

  // Avatar files are publicly viewable by any signed-in user.
  if (/^avatar-[A-Za-z0-9]+\.(png|jpg|jpeg|webp|gif)$/i.test(rawName)) {
    const avatarPath = path.join(uploadsDir, rawName);
    if (!fs.existsSync(avatarPath)) {
      return res.status(404).json({ error: "Avatar not found" });
    }
    const ext = path.extname(rawName).slice(1).toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(avatarPath);
  }

  const parsed = filenameSchema.safeParse(rawName);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filename = parsed.data;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  // A file may be referenced by many room messages or DMs (e.g. via forward).
  // The user has access if they belong to ANY referenced room or DM thread.
  const roomRows = db
    .prepare(
      `SELECT m.room_id, m.attachment_original_name AS name, m.attachment_mime_type AS mime
       FROM messages m WHERE m.attachment_filename = ?`,
    )
    .all(filename) as Array<{ room_id: number; name: string; mime: string }>;

  const dmRows = db
    .prepare(
      `SELECT d.sender_id, d.recipient_id,
              d.attachment_original_name AS name, d.attachment_mime_type AS mime
       FROM dms d WHERE d.attachment_filename = ?`,
    )
    .all(filename) as Array<{
    sender_id: number;
    recipient_id: number;
    name: string;
    mime: string;
  }>;

  if (roomRows.length === 0 && dmRows.length === 0) {
    return res.status(404).json({ error: "File not found" });
  }

  let access: { name: string; mime: string } | null = null;
  for (const r of roomRows) {
    const member = db
      .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
      .get(r.room_id, userId);
    if (member) {
      access = { name: r.name, mime: r.mime };
      break;
    }
  }
  if (!access) {
    for (const d of dmRows) {
      if (d.sender_id === userId || d.recipient_id === userId) {
        access = { name: d.name, mime: d.mime };
        break;
      }
    }
  }
  if (!access) return res.status(403).json({ error: "Forbidden" });

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });

  res.setHeader("Content-Type", access.mime || "application/octet-stream");
  // inline so browsers preview images/video/audio/pdf instead of downloading
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(access.name || filename)}`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

export default router;
