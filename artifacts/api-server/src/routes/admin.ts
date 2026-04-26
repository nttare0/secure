import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { requireAdmin } from "../lib/auth";
import { generalLimiter } from "../lib/rate-limit";
import { idParamSchema, adminPasswordResetSchema, validateBody } from "../lib/validation";
import { isUserOnline } from "../lib/realtime";

const router: IRouter = Router();

router.use(requireAdmin);
router.use(generalLimiter);

function parseId(value: unknown): number | null {
  const parsed = idParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

router.get("/stats", (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS userCount,
        (SELECT COUNT(*) FROM users WHERE is_admin = 1) AS adminCount,
        (SELECT COUNT(*) FROM users WHERE is_disabled = 1) AS disabledCount,
        (SELECT COUNT(*) FROM rooms) AS roomCount,
        (SELECT COUNT(*) FROM messages) AS messageCount,
        (SELECT COUNT(*) FROM dms) AS dmCount,
        (SELECT COUNT(*) FROM messages WHERE attachment_filename IS NOT NULL) +
        (SELECT COUNT(*) FROM dms WHERE attachment_filename IS NOT NULL) AS attachmentCount,
        (SELECT COUNT(*) FROM users WHERE last_seen_at > ?) AS activeRecently`,
    )
    .get(Date.now() - 5 * 60 * 1000) as Record<string, number>;

  const onlineUsers = db
    .prepare("SELECT id FROM users WHERE is_disabled = 0")
    .all()
    .filter((u: any) => isUserOnline(u.id)).length;

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE created_at > ?) AS newUsers24h,
        (SELECT COUNT(*) FROM messages WHERE created_at > ?) AS roomMessages24h,
        (SELECT COUNT(*) FROM dms WHERE created_at > ?) AS dms24h`,
    )
    .get(since, since, since) as Record<string, number>;

  res.json({ ...totals, onlineUsers, ...recent });
});

router.get("/users", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id,
              u.username,
              u.created_at AS createdAt,
              u.is_admin AS isAdmin,
              u.is_disabled AS isDisabled,
              u.last_seen_at AS lastSeen,
              u.avatar_kind AS avatarKind,
              u.avatar_value AS avatarValue,
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
      lastSeen: number | null;
      avatarKind: string;
      avatarValue: string | null;
      roomMessageCount: number;
      dmCount: number;
      roomsOwned: number;
    }>;
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      createdAt: r.createdAt,
      isAdmin: !!r.isAdmin,
      isDisabled: !!r.isDisabled,
      lastSeen: r.lastSeen,
      online: isUserOnline(r.id),
      avatar: { kind: r.avatarKind, value: r.avatarValue },
      roomMessageCount: r.roomMessageCount,
      dmCount: r.dmCount,
      roomsOwned: r.roomsOwned,
    })),
  });
});

router.get("/users/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });

  const user = db
    .prepare(
      `SELECT id, username, created_at AS createdAt, is_admin AS isAdmin, is_disabled AS isDisabled,
              last_seen_at AS lastSeen, avatar_kind AS avatarKind, avatar_value AS avatarValue,
              wallpaper_id AS wallpaperId
       FROM users WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        username: string;
        createdAt: number;
        isAdmin: number;
        isDisabled: number;
        lastSeen: number | null;
        avatarKind: string;
        avatarValue: string | null;
        wallpaperId: string | null;
      }
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
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      isAdmin: !!user.isAdmin,
      isDisabled: !!user.isDisabled,
      lastSeen: user.lastSeen,
      online: isUserOnline(user.id),
      avatar: { kind: user.avatarKind, value: user.avatarValue },
      wallpaperId: user.wallpaperId,
    },
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

router.post("/users/:id/promote", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });
  const target = db.prepare("SELECT is_admin, is_disabled FROM users WHERE id = ?").get(id) as
    | { is_admin: number; is_disabled: number }
    | undefined;
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.is_disabled) return res.status(400).json({ error: "Re-enable the user first" });
  if (target.is_admin) return res.status(400).json({ error: "User is already an admin" });
  db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(id);
  res.json({ ok: true });
});

router.post("/users/:id/demote", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid user id" });
  if (id === req.session.userId) {
    return res.status(400).json({ error: "You cannot remove your own admin role" });
  }
  const target = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(id) as
    | { is_admin: number }
    | undefined;
  if (!target) return res.status(404).json({ error: "User not found" });
  if (!target.is_admin) return res.status(400).json({ error: "User is not an admin" });
  // Don't allow demoting the last admin.
  const adminCount = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1").get() as { c: number }).c;
  if (adminCount <= 1) return res.status(400).json({ error: "Cannot remove the last admin" });
  db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(id);
  res.json({ ok: true });
});

router.post(
  "/users/:id/reset-password",
  validateBody(adminPasswordResetSchema),
  (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid user id" });
    const { newPassword } = (req as any).validated as { newPassword: string };
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const hash = bcrypt.hashSync(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
    res.json({ ok: true });
  },
);

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

router.get("/rooms", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.code, r.created_at AS createdAt,
              o.id AS ownerId, o.username AS ownerUsername,
              (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS memberCount,
              (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) AS messageCount,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.room_id = r.id) AS lastMessageAt
       FROM rooms r
       JOIN users o ON o.id = r.owner_id
       ORDER BY r.created_at DESC`,
    )
    .all();
  res.json({ rooms: rows });
});

router.delete("/rooms/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid room id" });
  const result = db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Room not found" });
  res.json({ ok: true });
});

export default router;
