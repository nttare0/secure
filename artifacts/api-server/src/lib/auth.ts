import type { Request, Response, NextFunction } from "express";
import { db } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const touchSeenStmt = db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?");
const lastTouchByUser = new Map<number, number>();
const TOUCH_INTERVAL_MS = 15_000;

export function touchLastSeen(userId: number): void {
  const now = Date.now();
  const last = lastTouchByUser.get(userId) ?? 0;
  if (now - last < TOUCH_INTERVAL_MS) return;
  lastTouchByUser.set(userId, now);
  try {
    touchSeenStmt.run(now, userId);
  } catch {
    /* ignore */
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  touchLastSeen(req.session.userId);
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const row = db
    .prepare("SELECT is_admin, is_disabled FROM users WHERE id = ?")
    .get(userId) as { is_admin: number; is_disabled: number } | undefined;
  if (!row || row.is_disabled || !row.is_admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
