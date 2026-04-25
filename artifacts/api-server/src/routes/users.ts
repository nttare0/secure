import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { updateSettingsSchema, validateBody } from "../lib/validation";
import { isUserOnline, emitToAll } from "../lib/realtime";

const router: IRouter = Router();

interface UserSettingsRow {
  id: number;
  username: string;
  is_admin: number;
  avatar_kind: string;
  avatar_value: string | null;
  wallpaper_id: string | null;
  last_seen_at: number | null;
}

function loadUser(id: number): UserSettingsRow | undefined {
  return db
    .prepare(
      `SELECT id, username, is_admin, avatar_kind, avatar_value, wallpaper_id, last_seen_at
       FROM users WHERE id = ?`,
    )
    .get(id) as UserSettingsRow | undefined;
}

function serialize(u: UserSettingsRow) {
  return {
    id: u.id,
    username: u.username,
    isAdmin: !!u.is_admin,
    avatar: { kind: u.avatar_kind, value: u.avatar_value },
    wallpaperId: u.wallpaper_id,
    lastSeen: u.last_seen_at,
    online: isUserOnline(u.id),
  };
}

router.get("/me", requireAuth, (req, res) => {
  const u = loadUser(req.session.userId!);
  if (!u) return res.status(404).json({ error: "Not found" });
  res.json(serialize(u));
});

router.patch(
  "/me",
  requireAuth,
  writeLimiter,
  validateBody(updateSettingsSchema),
  (req, res) => {
    const userId = req.session.userId!;
    const { wallpaperId, avatar } = (req as any).validated as {
      wallpaperId?: string | null;
      avatar?: { kind: "initials" } | { kind: "preset"; id: string };
    };
    const sets: string[] = [];
    const params: (string | null)[] = [];
    if (wallpaperId !== undefined) {
      sets.push("wallpaper_id = ?");
      params.push(wallpaperId === null ? null : wallpaperId);
    }
    if (avatar !== undefined) {
      sets.push("avatar_kind = ?");
      params.push(avatar.kind);
      sets.push("avatar_value = ?");
      params.push(avatar.kind === "preset" ? avatar.id : null);
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params, userId);
    const u = loadUser(userId)!;
    if (avatar !== undefined) {
      emitToAll({
        type: "user:profile",
        userId: u.id,
        username: u.username,
        avatar: { kind: u.avatar_kind, value: u.avatar_value },
      });
    }
    res.json(serialize(u));
  },
);

router.get("/", requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, username, avatar_kind, avatar_value, last_seen_at
       FROM users WHERE is_disabled = 0 ORDER BY username`,
    )
    .all() as Array<{
    id: number;
    username: string;
    avatar_kind: string;
    avatar_value: string | null;
    last_seen_at: number | null;
  }>;
  res.json(
    rows.map((r) => ({
      id: r.id,
      username: r.username,
      avatar: { kind: r.avatar_kind, value: r.avatar_value },
      lastSeen: r.last_seen_at,
      online: isUserOnline(r.id),
    })),
  );
});

export default router;
