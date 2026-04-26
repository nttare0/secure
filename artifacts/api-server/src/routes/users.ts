import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db, uploadsDir } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { writeLimiter, authLimiter } from "../lib/rate-limit";
import {
  updateSettingsSchema,
  passwordChangeSchema,
  validateBody,
} from "../lib/validation";
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
      avatar?:
        | { kind: "initials" }
        | { kind: "preset"; id: string }
        | { kind: "anime"; id: string }
        | { kind: "image"; url: string };
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
      if (avatar.kind === "preset" || avatar.kind === "anime") {
        params.push(avatar.id);
      } else if (avatar.kind === "image") {
        params.push(avatar.url);
      } else {
        params.push(null);
      }
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

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".png")
      .slice(0, 8)
      .replace(/[^A-Za-z0-9.]/g, "")
      .toLowerCase();
    const id = crypto.randomBytes(12).toString("hex");
    cb(null, `avatar-${id}${ext}`);
  },
});

const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4MB

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error("Only PNG, JPEG, WebP or GIF images are allowed"));
    }
    cb(null, true);
  },
});

router.post(
  "/me/avatar",
  requireAuth,
  writeLimiter,
  (req, res, next) => {
    avatarUpload.single("file")(req, res, (err: any) => {
      if (err) {
        return res
          .status(400)
          .json({ error: err.message || "Could not upload avatar" });
      }
      next();
    });
  },
  (req, res) => {
    const userId = req.session.userId!;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/api/uploads/${file.filename}`;

    // Clean up the previous uploaded avatar if any.
    const prev = db
      .prepare("SELECT avatar_kind, avatar_value FROM users WHERE id = ?")
      .get(userId) as { avatar_kind: string; avatar_value: string | null } | undefined;
    if (prev?.avatar_kind === "image" && prev.avatar_value) {
      const oldName = prev.avatar_value.split("/").pop();
      if (oldName && /^avatar-[A-Za-z0-9.]+$/.test(oldName)) {
        const p = path.join(uploadsDir, oldName);
        fs.promises.unlink(p).catch(() => undefined);
      }
    }

    db.prepare("UPDATE users SET avatar_kind = ?, avatar_value = ? WHERE id = ?").run(
      "image",
      url,
      userId,
    );
    const u = loadUser(userId)!;
    emitToAll({
      type: "user:profile",
      userId: u.id,
      username: u.username,
      avatar: { kind: u.avatar_kind, value: u.avatar_value },
    });
    res.json(serialize(u));
  },
);

router.post(
  "/me/password",
  requireAuth,
  authLimiter,
  validateBody(passwordChangeSchema),
  (req, res) => {
    const userId = req.session.userId!;
    const { currentPassword, newPassword } = (req as any).validated as {
      currentPassword: string;
      newPassword: string;
    };
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(userId) as { password_hash: string } | undefined;
    if (!row) return res.status(404).json({ error: "User not found" });
    if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const hash = bcrypt.hashSync(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
    res.json({ ok: true });
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
