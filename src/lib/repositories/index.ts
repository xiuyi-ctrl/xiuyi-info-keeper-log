import { getStoredToken } from "@/lib/client-auth";

// Re-export types
export type { Item, HistoryEntry, ItemAttachment } from "@/lib/vault";

// Re-export server functions with automatic token injection
import {
  serverFetchActiveItems,
  serverFetchItemById,
  serverCreateItem,
  serverUpdateItem,
  serverSoftDeleteItem,
  serverBulkSoftDeleteByCategory,
  serverFetchTrashedItems,
  serverRestoreItem,
  serverPurgeItem,
  serverPurgeExpiredTrash,
} from "@/actions/items";

import { serverFetchHistory, serverDeleteHistoryEntry } from "@/actions/history";

import {
  serverFetchAttachments,
  serverFetchAttachmentsForExport,
  serverDeleteAttachment,
} from "@/actions/attachments";

function withToken<T extends Record<string, unknown>>(args: T) {
  const token = getStoredToken();
  if (!token) throw new Error("Unauthorized");
  return { ...args, token } as T & { token: string };
}

export async function fetchActiveItems() {
  return serverFetchActiveItems();
}

export async function fetchItemById(id: string) {
  return serverFetchItemById({ data: { id } });
}

export async function createItem(data: Parameters<typeof serverCreateItem>[0]) {
  const token = getStoredToken();
  if (!token) throw new Error("Unauthorized");
  return serverCreateItem({ data: { ...data, token } });
}

export async function updateItem(
  id: string,
  data: Omit<Parameters<typeof serverUpdateItem>[0], "token" | "id">,
) {
  const token = getStoredToken();
  if (!token) throw new Error("Unauthorized");
  return serverUpdateItem({ data: { ...data, token, id } });
}

export async function softDeleteItem(id: string) {
  return serverSoftDeleteItem({
    data: withToken({ id }),
  });
}

export async function bulkSoftDeleteByCategory(category: string) {
  return serverBulkSoftDeleteByCategory({
    data: withToken({ category }),
  });
}

export async function fetchTrashedItems() {
  return serverFetchTrashedItems();
}

export async function restoreItem(id: string) {
  return serverRestoreItem({
    data: withToken({ id }),
  });
}

export async function purgeItem(id: string) {
  return serverPurgeItem({
    data: withToken({ id }),
  });
}

export async function purgeExpiredTrash() {
  return serverPurgeExpiredTrash({
    data: withToken({}),
  });
}

export async function fetchHistory(itemId: string) {
  return serverFetchHistory({ data: { itemId } });
}

export async function deleteHistoryEntry(id: string) {
  return serverDeleteHistoryEntry({
    data: withToken({ id }),
  });
}

export async function fetchAttachments(itemId: string) {
  return serverFetchAttachments({ data: { itemId } });
}

export async function fetchAttachmentsForExport(itemIds: string[]) {
  const token = getStoredToken();
  if (!token) throw new Error("Unauthorized");
  return serverFetchAttachmentsForExport({ data: { token, itemIds } });
}

export async function deleteAttachment(att: { id: string; file_path: string }) {
  return serverDeleteAttachment({
    data: withToken({ id: att.id, file_path: att.file_path }),
  });
}
