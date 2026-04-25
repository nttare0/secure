import type { Request, Response, NextFunction } from "express";
import { db } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
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
