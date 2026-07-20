import { createServerFn } from "@tanstack/react-start";
import { verifyToken } from "@/server/auth";
import * as repo from "@/server/repositories/history";

export const serverFetchHistory = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { itemId: string })
  .handler(async ({ data, request }) => {
    const auth = request.headers.get("Authorization");
    const token = auth?.slice(7);
    if (!token) throw new Error("Unauthorized");
    const payload = verifyToken(token);
    if (!payload) throw new Error("Unauthorized");
    return repo.fetchHistory(data.itemId, payload.userId);
  });

export const serverDeleteHistoryEntry = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; id: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    await repo.deleteHistoryEntry(data.id, payload.userId);
  });
