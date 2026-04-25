import type { Request, Response, NextFunction } from "express";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000; // 3 minutes

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

const attemptsByUser = new Map<string, AttemptRecord>();

function key(username: string): string {
  return username.trim().toLowerCase();
}

export function getLockoutStatus(username: string): {
  locked: boolean;
  lockedUntil: number;
  remaining: number;
} {
  const k = key(username);
  const rec = attemptsByUser.get(k);
  if (!rec) return { locked: false, lockedUntil: 0, remaining: MAX_ATTEMPTS };
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return { locked: true, lockedUntil: rec.lockedUntil, remaining: 0 };
  }
  return {
    locked: false,
    lockedUntil: 0,
    remaining: Math.max(0, MAX_ATTEMPTS - rec.count),
  };
}

export function registerFailedAttempt(username: string): {
  locked: boolean;
  lockedUntil: number;
  attemptsLeft: number;
} {
  const k = key(username);
  const now = Date.now();
  const rec = attemptsByUser.get(k);
  if (!rec || rec.lockedUntil < now - LOCKOUT_MS) {
    // fresh window
    attemptsByUser.set(k, { count: 1, lockedUntil: 0 });
    return { locked: false, lockedUntil: 0, attemptsLeft: MAX_ATTEMPTS - 1 };
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS;
    return { locked: true, lockedUntil: rec.lockedUntil, attemptsLeft: 0 };
  }
  return {
    locked: false,
    lockedUntil: 0,
    attemptsLeft: MAX_ATTEMPTS - rec.count,
  };
}

export function clearAttempts(username: string): void {
  attemptsByUser.delete(key(username));
}

export function lockoutGuard(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as { username?: unknown } | undefined;
  const username = typeof body?.username === "string" ? body.username : "";
  if (!username) return next();
  const status = getLockoutStatus(username);
  if (status.locked) {
    res.status(429).json({
      error: "Too many failed attempts. Please wait before trying again.",
      lockedUntil: status.lockedUntil,
      retryAfterMs: status.lockedUntil - Date.now(),
    });
    return;
  }
  next();
}

export const LOGIN_LOCKOUT_MS = LOCKOUT_MS;
export const LOGIN_MAX_ATTEMPTS = MAX_ATTEMPTS;
