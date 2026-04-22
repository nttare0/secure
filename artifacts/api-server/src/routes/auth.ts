import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

router.post("/register", (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password required" });
  }
  const u = username.trim();
  if (u.length < 3 || u.length > 24 || !/^[A-Za-z0-9_.-]+$/.test(u)) {
    return res.status(400).json({ error: "Username must be 3-24 chars (letters, numbers, _ . -)" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(u);
  if (existing) {
    return res.status(409).json({ error: "Username is already taken" });
  }
  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(u, hash, Date.now());
  const userId = Number(info.lastInsertRowid);
  req.session.userId = userId;
  res.json({ user: { id: userId, username: u } });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password required" });
  }
  const row = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username.trim()) as UserRow | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  req.session.userId = row.id;
  res.json({ user: { id: row.id, username: row.username } });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("vc.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT id, username FROM users WHERE id = ?")
    .get(req.session.userId) as { id: number; username: string } | undefined;
  if (!row) return res.status(401).json({ error: "Not authenticated" });
  res.json({ user: row });
});

export default router;
