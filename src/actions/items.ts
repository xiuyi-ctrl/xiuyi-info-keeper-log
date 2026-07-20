import { createServerFn } from "@tanstack/react-start";
import { verifyToken } from "@/server/auth";
import * as repo from "@/server/repositories/items";
import { insertHistory } from "@/server/repositories/history";
import { fetchAttachments } from "@/server/repositories/attachments";

export const serverFetchActiveItems = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    const auth = request.headers.get("Authorization");
    const token = auth?.slice(7);
    if (!token) throw new Error("Unauthorized");
    const payload = verifyToken(token);
    if (!payload) throw new Error("Unauthorized");
    return repo.fetchActiveItems(payload.userId);
  },
);

export const serverFetchItemById = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data, request }) => {
    const auth = request.headers.get("Authorization");
    const token = auth?.slice(7);
    if (!token) throw new Error("Unauthorized");
    const payload = verifyToken(token);
    if (!payload) throw new Error("Unauthorized");
    return repo.fetchItemById(data.id, payload.userId);
  });

export const serverCreateItem = createServerFn({ method: "POST" })
  .validator(
    (d: unknown) =>
      d as {
        token: string;
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
      },
  )
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    const id = await repo.createItem({ ...data, user_id: payload.userId });
    const item = await repo.fetchItemById(id, payload.userId);
    if (item) {
      const atts = await fetchAttachments(id, payload.userId);
      await insertHistory({
        item_id: id,
        user_id: payload.userId,
        action: "create",
        snapshot: { ...item, attachments: atts } as never,
      });
    }
    return id;
  });

export const serverUpdateItem = createServerFn({ method: "POST" })
  .validator(
    (d: unknown) =>
      d as {
        token: string;
        id: string;
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
  )
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    const { token: _token, id: _id, ...itemData } = data;
    await repo.updateItem(data.id, payload.userId, itemData);
    const item = await repo.fetchItemById(data.id, payload.userId);
    if (item) {
      const atts = await fetchAttachments(data.id, payload.userId);
      await insertHistory({
        item_id: data.id,
        user_id: payload.userId,
        action: "update",
        snapshot: { ...item, attachments: atts } as never,
      });
    }
  });

export const serverSoftDeleteItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; id: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    await repo.softDeleteItem(data.id, payload.userId);
    const item = await repo.fetchItemById(data.id, payload.userId);
    if (item) {
      await insertHistory({
        item_id: data.id,
        user_id: payload.userId,
        action: "delete",
        snapshot: { ...item, attachments: [] } as never,
      });
    }
  });

export const serverBulkSoftDeleteByCategory = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; category: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    const ids = await repo.bulkSoftDeleteByCategory(data.category, payload.userId);
    for (const id of ids) {
      const item = await repo.fetchItemById(id, payload.userId);
      if (item) {
        const atts = await fetchAttachments(id, payload.userId);
        await insertHistory({
          item_id: id,
          user_id: payload.userId,
          action: "delete",
          snapshot: { ...item, attachments: atts } as never,
        });
      }
    }
  });

export const serverFetchTrashedItems = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    const auth = request.headers.get("Authorization");
    const token = auth?.slice(7);
    if (!token) throw new Error("Unauthorized");
    const payload = verifyToken(token);
    if (!payload) throw new Error("Unauthorized");
    return repo.fetchTrashedItems(payload.userId);
  },
);

export const serverRestoreItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; id: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    await repo.restoreItem(data.id, payload.userId);
    const item = await repo.fetchItemById(data.id, payload.userId);
    if (item) {
      const atts = await fetchAttachments(data.id, payload.userId);
      await insertHistory({
        item_id: data.id,
        user_id: payload.userId,
        action: "restore",
        snapshot: { ...item, attachments: atts } as never,
      });
    }
  });

export const serverPurgeItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; id: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    await repo.purgeItem(data.id, payload.userId);
  });

export const serverPurgeExpiredTrash = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    return repo.purgeExpiredTrash(payload.userId);
  });
