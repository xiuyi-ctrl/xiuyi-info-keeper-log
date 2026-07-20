import * as fs from "node:fs";
import * as path from "node:path";
import { query, queryOne } from "@/server/db";

type AttachmentRow = {
  id: string;
  item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  size: number;
  mime_type: string | null;
  created_at: string;
};

export async function fetchAttachments(itemId: string, userId: string) {
  const rows = await query<AttachmentRow[]>(
    "SELECT id,file_name,file_path,mime_type,size FROM item_attachments WHERE item_id = ? AND user_id = ? ORDER BY created_at",
    [itemId, userId],
  );
  return rows;
}

export async function fetchAttachmentsForExport(itemIds: string[], userId: string) {
  if (itemIds.length === 0) return [];
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = await query<AttachmentRow[]>(
    `SELECT id,item_id,file_name,file_path,mime_type,size FROM item_attachments WHERE item_id IN (${placeholders}) AND user_id = ?`,
    [...itemIds, userId],
  );
  return rows;
}

export async function deleteAttachment(att: {
  id: string;
  userId: string;
  file_path: string;
}): Promise<void> {
  const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
  const absolutePath = path.resolve(UPLOADS_ROOT, att.file_path);
  if (absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
    await fs.promises.unlink(absolutePath).catch(() => {});
  }
  await query("DELETE FROM item_attachments WHERE id = ? AND user_id = ?", [att.id, att.userId]);
}
