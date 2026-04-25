import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { logger } from "./logger";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CREDS_FILE = path.join(DATA_DIR, "admin-credentials.txt");

function generatePassword(): string {
  return crypto.randomBytes(12).toString("base64url").slice(0, 16);
}

export function seedAdmin(): void {
  const adminCount = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1")
    .get() as { n: number };
  if (adminCount.n > 0) return;

  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    logger.warn({ username }, "ADMIN_USERNAME invalid; skipping admin seed");
    return;
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as { id: number } | undefined;

  if (existing) {
    db.prepare("UPDATE users SET is_admin = 1, is_disabled = 0 WHERE id = ?").run(existing.id);
    logger.info({ username }, "Promoted existing user to admin");
    return;
  }

  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password || password.length < 8) {
    password = generatePassword();
    generated = true;
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare(
    "INSERT INTO users (username, password_hash, created_at, is_admin, is_disabled) VALUES (?, ?, ?, 1, 0)",
  ).run(username, hash, Date.now());

  if (generated) {
    try {
      fs.writeFileSync(
        CREDS_FILE,
        `Admin account created on ${new Date().toISOString()}\nUsername: ${username}\nPassword: ${password}\n\nKeep this file secret. Set ADMIN_PASSWORD in the environment to override on next reset.\n`,
        { mode: 0o600 },
      );
    } catch (err) {
      logger.warn({ err }, "Could not write admin credentials file");
    }
    logger.info(
      `\n========================================\n  ADMIN ACCOUNT CREATED\n  Username: ${username}\n  Password: ${password}\n  (also written to ${CREDS_FILE})\n========================================\n`,
    );
  } else {
    logger.info({ username }, "Admin account created from ADMIN_PASSWORD env var");
  }
}
