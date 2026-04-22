import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/:filename", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const filename = req.params.filename;
  if (!/^[A-Za-z0-9.]+$/.test(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const row = db
    .prepare(
      `SELECT m.attachment_original_name AS name, m.attachment_mime_type AS mime, m.room_id AS roomId
       FROM messages m
       WHERE m.attachment_filename = ?
       LIMIT 1`,
    )
    .get(filename) as { name: string; mime: string; roomId: number } | undefined;
  if (!row) return res.status(404).json({ error: "File not found" });
  const isMember = db
    .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .get(row.roomId, userId);
  if (!isMember) return res.status(403).json({ error: "Forbidden" });
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
  res.setHeader("Content-Type", row.mime || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(row.name || filename)}`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

export default router;
