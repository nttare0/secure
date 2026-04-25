import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { requireAdmin } from "../lib/auth";
import { generalLimiter } from "../lib/rate-limit";
import { idParamSchema } from "../lib/validation";

const router: IRouter = Router();

router.use(requireAdmin);
router.use(generalLimiter);

function parseId(value: unknown): number | null {
  const parsed = idParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

router.get("/users", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id,
              u.username,
              u.created_at AS createdAt,
              u.is_admin AS isAdmin,
              u.is_disabled AS isDisabled,
              (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS roomMessageCount,
              (SELECT COUNT(*) FROM dms d WHERE d.sender_id = u.id) AS dmCount,
              (SELECT COUNT(*) FROM rooms r WHERE r.owner_id = u.id) AS roomsOwned
       FROM users u
       ORDER BY u.created_at DESC`,
    )
    .all() as Array<{
      id: number;
      username: string;
      createdAt: number;
      isAdmin: number;
      isDisabled: number;
      roomMessageCount: number;
      dmCount: number;
      roomsOwned: number;
    }>;
  res.json({
    users: rows.map((r) => ({
      ...r,
      isAdmin: !!r.isAdmin,
      isDisabled: !!r.isDisabled,
    })),
  });
});

router.get("/users/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });

  const user = db
    .prepare(
      `SELECT id, username, created_at AS createdAt, is_admin AS isAdmin, is_disabled AS isDisabled
       FROM users WHERE id = ?`,
    )
    .get(id) as
    | { id: number; username: string; createdAt: number; isAdmin: number; isDisabled: number }
    | undefined;
  if (!user) return res.status(404).json({ error: "User not found" });

  const roomMessages = db
    .prepare(
      `SELECT m.id, m.content, m.created_at AS createdAt, m.attachment_original_name AS attachmentName,
              r.id AS roomId, r.name AS roomName
       FROM messages m JOIN rooms r ON r.id = m.room_id
       WHERE m.user_id = ?
       ORDER BY m.id DESC LIMIT 200`,
    )
    .all(id);

  const dms = db
    .prepare(
      `SELECT d.id, d.content, d.created_at AS createdAt, d.attachment_original_name AS attachmentName,
              s.id AS senderId, s.username AS senderUsername,
              rcp.id AS recipientId, rcp.username AS recipientUsername
       FROM dms d
       JOIN users s ON s.id = d.sender_id
       JOIN users rcp ON rcp.id = d.recipient_id
       WHERE d.sender_id = ? OR d.recipient_id = ?
       ORDER BY d.id DESC LIMIT 200`,
    )
    .all(id, id);

  const rooms = db
    .prepare(
      `SELECT r.id, r.name, r.code, r.created_at AS createdAt,
              (r.owner_id = ?) AS isOwner
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.user_id = ?
       ORDER BY r.id DESC`,
    )
    .all(id, id) as Array<{ id: number; name: string; code: string; createdAt: number; isOwner: number }>;

  res.json({
    user: { ...user, isAdmin: !!user.isAdmin, isDisabled: !!user.isDisabled },
    rooms: rooms.map((r) => ({ ...r, isOwner: !!r.isOwner })),
    roomMessages,
    dms,
  });
});

router.post("/users/:id/disable", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });
  if (id === req.session.userId) {
    return res.status(400).json({ error: "You cannot disable your own admin account" });
  }
  const target = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(id) as
    | { is_admin: number }
    | undefined;
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.is_admin) return res.status(400).json({ error: "Cannot disable another admin" });

  db.prepare("UPDATE users SET is_disabled = 1 WHERE id = ?").run(id);
  res.json({ ok: true });
});

router.post("/users/:id/enable", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });
  const result = db.prepare("UPDATE users SET is_disabled = 0 WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

router.delete("/users/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });
  if (id === req.session.userId) {
    return res.status(400).json({ error: "You cannot delete your own admin account" });
  }
  const target = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(id) as
    | { is_admin: number }
    | undefined;
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.is_admin) return res.status(400).json({ error: "Cannot delete another admin" });

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});

router.delete("/messages/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid message id" });
  const result = db.prepare("DELETE FROM messages WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Message not found" });
  res.json({ ok: true });
});

router.delete("/dms/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid message id" });
  const result = db.prepare("DELETE FROM dms WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Message not found" });
  res.json({ ok: true });
});

export default router;
