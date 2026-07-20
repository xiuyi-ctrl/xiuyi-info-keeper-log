import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { query, queryOne } from "@/server/db";

type ItemRow = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  tags: string | null;
  account: string | null;
  password_hint: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  extra: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function parseField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(raw as string) as T;
  } catch {
    return fallback;
  }
}

function toItem(row: ItemRow) {
  return {
    ...row,
    tags: parseField<string[]>(row.tags, []),
    extra: parseField<Record<string, unknown>>(row.extra, {}),
  };
}

export async function fetchActiveItems(userId: string) {
  const rows = await query<ItemRow[]>(
    "SELECT id,name,category,tags,account,password_hint,phone,email,notes,extra,created_at,updated_at FROM items WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC",
    [userId],
  );
  return rows.map(toItem);
}

export async function fetchItemById(id: string, userId: string) {
  const row = await queryOne<ItemRow>("SELECT * FROM items WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  return row ? toItem(row) : null;
}

export async function createItem(data: {
  user_id: string;
  name: string;
  category: string;
  tags: string[];
  account?: string | null;
  password_hint?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  extra?: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO items (id, user_id, name, category, tags, account, password_hint, phone, email, notes, extra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.user_id,
      data.name,
      data.category,
      JSON.stringify(data.tags ?? []),
      data.account ?? null,
      data.password_hint ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.notes ?? null,
      data.extra ? JSON.stringify(data.extra) : null,
    ],
  );
  return id;
}

export async function updateItem(
  id: string,
  userId: string,
  data: {
    name: string;
    category: string;
    tags: string[];
    account?: string | null;
    password_hint?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  await query(
    `UPDATE items SET name=?, category=?, tags=?, account=?, password_hint=?, phone=?, email=?, notes=?, extra=? WHERE id=? AND user_id=?`,
    [
      data.name,
      data.category,
      JSON.stringify(data.tags ?? []),
      data.account ?? null,
      data.password_hint ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.notes ?? null,
      data.extra ? JSON.stringify(data.extra) : null,
      id,
      userId,
    ],
  );
}

export async function softDeleteItem(id: string, userId: string): Promise<void> {
  await query("UPDATE items SET deleted_at = NOW() WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function bulkSoftDeleteByCategory(
  category: string,
  userId: string,
): Promise<string[]> {
  const rows = await query<{ id: string }[]>(
    "SELECT id FROM items WHERE category = ? AND user_id = ? AND deleted_at IS NULL",
    [category, userId],
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  await query(`UPDATE items SET deleted_at = NOW() WHERE id IN (${placeholders})`, ids);
  return ids;
}

export async function fetchTrashedItems(userId: string) {
  const rows = await query<ItemRow[]>(
    "SELECT id,name,category,tags,account,password_hint,phone,email,notes,extra,deleted_at,created_at,updated_at FROM items WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    [userId],
  );
  return rows.map(toItem);
}

export async function restoreItem(id: string, userId: string): Promise<void> {
  await query("UPDATE items SET deleted_at = NULL WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function purgeItem(id: string, userId: string): Promise<void> {
  const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
  const attRows = await query<{ file_path: string }[]>(
    "SELECT file_path FROM item_attachments WHERE item_id = ? AND user_id = ?",
    [id, userId],
  );
  for (const att of attRows) {
    const abs = path.resolve(UPLOADS_ROOT, att.file_path);
    if (abs.startsWith(UPLOADS_ROOT + path.sep)) {
      await fs.promises.unlink(abs).catch(() => {});
    }
  }
  await query("DELETE FROM item_attachments WHERE item_id = ? AND user_id = ?", [id, userId]);
  await query("DELETE FROM item_history WHERE item_id = ? AND user_id = ?", [id, userId]);
  await query("DELETE FROM items WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function purgeExpiredTrash(userId: string): Promise<string[]> {
  const rows = await query<{ id: string }[]>(
    "SELECT id FROM items WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 7 DAY)",
    [userId],
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
  const attRows = await query<{ file_path: string }[]>(
    `SELECT file_path FROM item_attachments WHERE item_id IN (${placeholders}) AND user_id = ?`,
    [...ids, userId],
  );
  for (const att of attRows) {
    const abs = path.resolve(UPLOADS_ROOT, att.file_path);
    if (abs.startsWith(UPLOADS_ROOT + path.sep)) {
      await fs.promises.unlink(abs).catch(() => {});
    }
  }
  await query(`DELETE FROM item_attachments WHERE item_id IN (${placeholders}) AND user_id = ?`, [
    ...ids,
    userId,
  ]);
  await query(`DELETE FROM item_history WHERE item_id IN (${placeholders}) AND user_id = ?`, [
    ...ids,
    userId,
  ]);
  await query(`DELETE FROM items WHERE id IN (${placeholders})`, ids);
  return ids;
}
