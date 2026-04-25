import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";
import { authLimiter, registerLimiter } from "../lib/rate-limit";
import {
  credentialsSchema,
  registerSchema,
  validateBody,
} from "../lib/validation";

const router: IRouter = Router();

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  is_disabled: number;
}

function generateRoomCode(): string {
  return crypto.randomBytes(5).toString("base64url").slice(0, 8).toUpperCase();
}

function createStarterRoom(userId: number, username: string): void {
  let code = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    if (!db.prepare("SELECT 1 FROM rooms WHERE code = ?").get(code)) break;
    code = generateRoomCode();
  }
  const now = Date.now();
  const info = db
    .prepare("INSERT INTO rooms (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)")
    .run(`${username}'s Room`, code, userId, now);
  db.prepare("INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)").run(
    Number(info.lastInsertRowid),
    userId,
    now,
  );
}

router.post(
  "/register",
  registerLimiter,
  authLimiter,
  validateBody(registerSchema),
  (req, res) => {
    const { username, password } = (req as any).validated as { username: string; password: string };
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(409).json({ error: "Username is already taken" });
    }
    const hash = bcrypt.hashSync(password, 12);
    const info = db
      .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
      .run(username, hash, Date.now());
    const userId = Number(info.lastInsertRowid);
    createStarterRoom(userId, username);
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Could not start session" });
      req.session.userId = userId;
      res.json({ user: { id: userId, username, isAdmin: false } });
    });
  },
);

router.post("/login", authLimiter, validateBody(credentialsSchema), (req, res) => {
  const { username, password, rememberMe } = (req as any).validated as {
    username: string;
    password: string;
    rememberMe: boolean;
  };
  const row = db
    .prepare(
      "SELECT id, username, password_hash, is_admin, is_disabled FROM users WHERE username = ?",
    )
    .get(username) as UserRow | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  if (row.is_disabled) {
    return res.status(403).json({ error: "This account has been disabled. Contact an administrator." });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start session" });
    req.session.userId = row.id;
    if (rememberMe === false) {
      // Browser-session cookie (cleared when browser closes)
      (req.session.cookie as unknown as { expires: false }).expires = false;
      req.session.cookie.maxAge = undefined as unknown as number;
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    }
    res.json({ user: { id: row.id, username: row.username, isAdmin: !!row.is_admin } });
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("vc.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT id, username, is_admin, is_disabled FROM users WHERE id = ?")
    .get(req.session.userId) as
    | { id: number; username: string; is_admin: number; is_disabled: number }
    | undefined;
  if (!row || row.is_disabled) {
    req.session.destroy(() => undefined);
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: { id: row.id, username: row.username, isAdmin: !!row.is_admin } });
});

export default router;
