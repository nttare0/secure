import { Store, type SessionData } from "express-session";
import { db } from "./db";

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
`);

const getStmt = db.prepare("SELECT sess, expire FROM sessions WHERE sid = ?");
const setStmt = db.prepare(
  "INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) " +
    "ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire",
);
const delStmt = db.prepare("DELETE FROM sessions WHERE sid = ?");
const cleanStmt = db.prepare("DELETE FROM sessions WHERE expire < ?");
const touchStmt = db.prepare("UPDATE sessions SET expire = ? WHERE sid = ?");

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function expireFromSession(sess: SessionData): number {
  const cookieExpires = sess.cookie?.expires;
  if (cookieExpires) {
    const t = new Date(cookieExpires).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.now() + DEFAULT_TTL_MS;
}

export class SqliteStore extends Store {
  constructor() {
    super();
    setInterval(() => {
      try {
        cleanStmt.run(Date.now());
      } catch {
        /* ignore */
      }
    }, 60 * 60 * 1000).unref();
  }

  override get(sid: string, cb: (err: unknown, sess?: SessionData | null) => void): void {
    try {
      const row = getStmt.get(sid) as { sess: string; expire: number } | undefined;
      if (!row) return cb(null, null);
      if (row.expire < Date.now()) {
        delStmt.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.sess) as SessionData);
    } catch (err) {
      cb(err);
    }
  }

  override set(sid: string, sess: SessionData, cb?: (err?: unknown) => void): void {
    try {
      setStmt.run(sid, JSON.stringify(sess), expireFromSession(sess));
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override destroy(sid: string, cb?: (err?: unknown) => void): void {
    try {
      delStmt.run(sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override touch(sid: string, sess: SessionData, cb?: () => void): void {
    try {
      touchStmt.run(expireFromSession(sess), sid);
    } catch {
      /* ignore */
    }
    cb?.();
  }
}
