import { uploadAttachmentFn, downloadAttachmentFn } from "@/actions/upload";
import type { ItemAttachment } from "@/lib/vault";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vault:token");
}

export async function openAttachment(att: ItemAttachment) {
  const token = getToken();
  if (!token) return null;
  const base64 = await downloadAttachmentFn({
    data: { token, filePath: att.file_path },
  });
  if (!base64) return null;

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: att.mime_type ?? undefined });
  return URL.createObjectURL(blob);
}

export async function previewBlob(att: ItemAttachment): Promise<Blob | null> {
  const token = getToken();
  if (!token) return null;
  const base64 = await downloadAttachmentFn({
    data: { token, filePath: att.file_path },
  });
  if (!base64) return null;

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: att.mime_type ?? undefined });
}

export async function downloadAttachment(att: ItemAttachment) {
  const blob = await previewBlob(att);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.file_name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function uploadFile(params: {
  token: string;
  userId: string;
  itemId: string;
  file: File;
  path: string;
}) {
  const reader = new FileReader();
  const fileData = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(params.file);
  });

  return uploadAttachmentFn({
    data: {
      token: params.token,
      userId: params.userId,
      itemId: params.itemId,
      fileName: params.file.name,
      filePath: params.path,
      fileData,
      fileSize: params.file.size,
      mimeType: params.file.type,
    },
  });
}
