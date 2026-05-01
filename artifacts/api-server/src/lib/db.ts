import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

export const dbPath = path.join(DATA_DIR, "vaultchat.db");
export const uploadsDir = path.join(DATA_DIR, "uploads");

export const db: Database.Database = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_disabled INTEGER NOT NULL DEFAULT 0,
    last_seen_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (room_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    attachment_filename TEXT,
    attachment_original_name TEXT,
    attachment_mime_type TEXT,
    attachment_size INTEGER,
    created_at INTEGER NOT NULL,
    edited_at INTEGER,
    reply_to_id INTEGER,
    forwarded_from_username TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id, id);
  CREATE INDEX IF NOT EXISTS idx_messages_attachment ON messages(attachment_filename);

  CREATE TABLE IF NOT EXISTS dms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    attachment_filename TEXT,
    attachment_original_name TEXT,
    attachment_mime_type TEXT,
    attachment_size INTEGER,
    created_at INTEGER NOT NULL,
    edited_at INTEGER,
    reply_to_id INTEGER,
    forwarded_from_username TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_dms_pair ON dms(sender_id, recipient_id, id);
  CREATE INDEX IF NOT EXISTS idx_dms_recipient ON dms(recipient_id, id);
  CREATE INDEX IF NOT EXISTS idx_dms_attachment ON dms(attachment_filename);
`);

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}
if (!hasColumn("users", "is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;");
}
if (!hasColumn("users", "is_disabled")) {
  db.exec("ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;");
}
if (!hasColumn("users", "last_seen_at")) {
  db.exec("ALTER TABLE users ADD COLUMN last_seen_at INTEGER;");
}
if (!hasColumn("users", "avatar_kind")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_kind TEXT NOT NULL DEFAULT 'initials';");
}
if (!hasColumn("users", "avatar_value")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_value TEXT;");
}
if (!hasColumn("users", "wallpaper_id")) {
  db.exec("ALTER TABLE users ADD COLUMN wallpaper_id TEXT;");
}
for (const table of ["messages", "dms"] as const) {
  if (!hasColumn(table, "edited_at")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN edited_at INTEGER;`);
  }
  if (!hasColumn(table, "reply_to_id")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN reply_to_id INTEGER;`);
  }
  if (!hasColumn(table, "forwarded_from_username")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN forwarded_from_username TEXT;`);
  }
  if (!hasColumn(table, "message_type")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN message_type TEXT NOT NULL DEFAULT 'message';`);
  }
  if (!hasColumn(table, "call_kind")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN call_kind TEXT;`);
  }
  if (!hasColumn(table, "call_duration")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN call_duration INTEGER;`);
  }
  if (!hasColumn(table, "call_participants")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN call_participants TEXT;`);
  }
}
