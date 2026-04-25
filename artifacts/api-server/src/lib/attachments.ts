import fs from "node:fs";
import path from "node:path";
import { db, uploadsDir } from "./db";

/**
 * Delete an upload from disk, but only if no remaining message or DM row references it.
 * Safe to call when filename is null/undefined.
 */
export function maybeUnlinkAttachment(filename: string | null | undefined): void {
  if (!filename) return;
  const m = db
    .prepare("SELECT 1 FROM messages WHERE attachment_filename = ? LIMIT 1")
    .get(filename);
  if (m) return;
  const d = db
    .prepare("SELECT 1 FROM dms WHERE attachment_filename = ? LIMIT 1")
    .get(filename);
  if (d) return;
  const filePath = path.join(uploadsDir, filename);
  fs.unlink(filePath, () => {});
}
