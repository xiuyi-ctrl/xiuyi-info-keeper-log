import { randomUUID } from "node:crypto";
import { query } from "@/server/db";
import type { HistoryEntry } from "@/lib/vault";

function parseSnapshot(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

export async function fetchHistory(itemId: string, userId: string): Promise<HistoryEntry[]> {
  const rows = await query<HistoryEntry[]>(
    "SELECT * FROM item_history WHERE item_id = ? AND user_id = ? ORDER BY changed_at DESC",
    [itemId, userId],
  );
  return rows.map((r) => ({
    ...r,
    snapshot: parseSnapshot(r.snapshot),
  }));
}

export async function deleteHistoryEntry(id: string, userId: string): Promise<void> {
  await query("DELETE FROM item_history WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function insertHistory(entry: {
  item_id: string;
  user_id: string;
  action: string;
  snapshot: Record<string, unknown>;
}): Promise<void> {
  await query(
    "INSERT INTO item_history (id, item_id, user_id, action, snapshot) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), entry.item_id, entry.user_id, entry.action, JSON.stringify(entry.snapshot)],
  );
}
