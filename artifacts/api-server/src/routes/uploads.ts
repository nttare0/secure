import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { filenameSchema } from "../lib/validation";

const router: IRouter = Router();

router.get("/:filename", requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const parsed = filenameSchema.safeParse(req.params.filename);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filename = parsed.data;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
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
  const dmRow = !row
    ? (db
        .prepare(
          `SELECT d.attachment_original_name AS name, d.attachment_mime_type AS mime,
                  d.sender_id AS senderId, d.recipient_id AS recipientId
           FROM dms d WHERE d.attachment_filename = ? LIMIT 1`,
        )
        .get(filename) as
        | { name: string; mime: string; senderId: number; recipientId: number }
        | undefined)
    : undefined;
  if (!row && !dmRow) return res.status(404).json({ error: "File not found" });
  let name: string;
  let mime: string;
  if (row) {
    const isMember = db
      .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
      .get(row.roomId, userId);
    if (!isMember) return res.status(403).json({ error: "Forbidden" });
    name = row.name;
    mime = row.mime;
  } else {
    if (dmRow!.senderId !== userId && dmRow!.recipientId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    name = dmRow!.name;
    mime = dmRow!.mime;
  }
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
  res.setHeader("Content-Type", mime || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(name || filename)}`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

export default router;
