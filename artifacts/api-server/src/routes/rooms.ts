import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(requireAuth);

function generateCode(): string {
  return crypto.randomBytes(5).toString("base64url").slice(0, 8).toUpperCase();
}

function ensureMember(roomId: number, userId: number): boolean {
  const row = db
    .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .get(roomId, userId);
  return !!row;
}

router.get("/", (req, res) => {
  const userId = req.session.userId!;
  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.code, r.owner_id,
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS member_count,
              (SELECT MAX(created_at) FROM messages WHERE room_id = r.id) AS last_message_at
       FROM rooms r
       JOIN room_members m ON m.room_id = r.id
       WHERE m.user_id = ?
       ORDER BY COALESCE(last_message_at, r.created_at) DESC`,
    )
    .all(userId) as Array<{
      id: number;
      name: string;
      code: string;
      owner_id: number;
      member_count: number;
      last_message_at: number | null;
    }>;
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      isOwner: r.owner_id === userId,
      memberCount: r.member_count,
      lastMessageAt: r.last_message_at,
    })),
  );
});

router.post("/", (req, res) => {
  const userId = req.session.userId!;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 60) {
    return res.status(400).json({ error: "Name must be 1-60 characters" });
  }
  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const exists = db.prepare("SELECT 1 FROM rooms WHERE code = ?").get(code);
    if (!exists) break;
    code = generateCode();
  }
  const now = Date.now();
  const info = db
    .prepare("INSERT INTO rooms (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)")
    .run(name, code, userId, now);
  const id = Number(info.lastInsertRowid);
  db.prepare("INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    now,
  );
  res.json({ id, name, code, isOwner: true, memberCount: 1, lastMessageAt: null });
});

router.post("/join", (req, res) => {
  const userId = req.session.userId!;
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!code) return res.status(400).json({ error: "Invite code required" });
  const room = db
    .prepare("SELECT id, name, code, owner_id FROM rooms WHERE code = ?")
    .get(code) as { id: number; name: string; code: string; owner_id: number } | undefined;
  if (!room) return res.status(404).json({ error: "Invalid invite code" });
  if (ensureMember(room.id, userId)) {
    return res.json({
      id: room.id,
      name: room.name,
      code: room.code,
      isOwner: room.owner_id === userId,
    });
  }
  db.prepare("INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)").run(
    room.id,
    userId,
    Date.now(),
  );
  res.json({
    id: room.id,
    name: room.name,
    code: room.code,
    isOwner: room.owner_id === userId,
  });
});

router.post("/:id/leave", (req, res) => {
  const userId = req.session.userId!;
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId)) return res.status(400).json({ error: "Invalid room id" });
  const room = db.prepare("SELECT owner_id FROM rooms WHERE id = ?").get(roomId) as
    | { owner_id: number }
    | undefined;
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.owner_id === userId) {
    return res.status(400).json({ error: "Owner cannot leave; delete the room instead" });
  }
  db.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?").run(roomId, userId);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  const userId = req.session.userId!;
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId)) return res.status(400).json({ error: "Invalid room id" });
  const room = db.prepare("SELECT owner_id FROM rooms WHERE id = ?").get(roomId) as
    | { owner_id: number }
    | undefined;
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.owner_id !== userId) return res.status(403).json({ error: "Only the owner can delete" });
  db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  res.json({ ok: true });
});

router.get("/:id/members", (req, res) => {
  const userId = req.session.userId!;
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId)) return res.status(400).json({ error: "Invalid room id" });
  if (!ensureMember(roomId, userId)) return res.status(403).json({ error: "Not a member" });
  const rows = db
    .prepare(
      `SELECT u.id, u.username FROM users u
       JOIN room_members m ON m.user_id = u.id
       WHERE m.room_id = ?
       ORDER BY u.username`,
    )
    .all(roomId);
  res.json(rows);
});

export default router;
