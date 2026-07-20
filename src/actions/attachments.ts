import { createServerFn } from "@tanstack/react-start";
import { verifyToken } from "@/server/auth";
import * as repo from "@/server/repositories/attachments";

export const serverFetchAttachments = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { itemId: string })
  .handler(async ({ data, request }) => {
    const auth = request.headers.get("Authorization");
    const token = auth?.slice(7);
    if (!token) throw new Error("Unauthorized");
    const payload = verifyToken(token);
    if (!payload) throw new Error("Unauthorized");
    return repo.fetchAttachments(data.itemId, payload.userId);
  });

export const serverFetchAttachmentsForExport = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; itemIds: string[] })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    return repo.fetchAttachmentsForExport(data.itemIds, payload.userId);
  });

export const serverDeleteAttachment = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; id: string; file_path: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    await repo.deleteAttachment({ id: data.id, file_path: data.file_path, userId: payload.userId });
  });
