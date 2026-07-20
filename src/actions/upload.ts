import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { verifyToken } from "@/server/auth";
import { query, queryOne } from "@/server/db";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

export const uploadAttachmentFn = createServerFn({ method: "POST" })
  .validator(
    (d: unknown) =>
      d as {
        token: string;
        userId: string;
        itemId: string;
        fileName: string;
        filePath: string;
        fileData: string;
        fileSize: number;
        mimeType: string;
      },
  )
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload || payload.userId !== data.userId) {
      throw new Error("Unauthorized");
    }

    const absolutePath = path.resolve(UPLOADS_ROOT, data.filePath);
    if (!absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
      throw new Error("Invalid file path");
    }
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });

    const buffer = Buffer.from(data.fileData, "base64");
    await fs.promises.writeFile(absolutePath, buffer);

    const id = randomUUID();
    await query(
      `INSERT INTO item_attachments (id, item_id, user_id, file_name, file_path, size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.itemId, data.userId, data.fileName, data.filePath, data.fileSize, data.mimeType],
    );

    const row = await queryOne<{
      id: string;
      file_name: string;
      file_path: string;
      mime_type: string | null;
      size: number;
    }>("SELECT id,file_name,file_path,mime_type,size FROM item_attachments WHERE id = ?", [id]);
    return row!;
  });

export const downloadAttachmentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token: string; filePath: string })
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const absolutePath = path.resolve(UPLOADS_ROOT, data.filePath);
    if (!absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
      throw new Error("Invalid file path");
    }
    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
      const buffer = await fs.promises.readFile(absolutePath);
      return buffer.toString("base64");
    } catch {
      return null;
    }
  });
