import { toast } from "sonner";
import { getSignedUrl, downloadFile } from "@/lib/repositories/attachments";
import type { ItemAttachment } from "@/lib/vault";

export async function openAttachment(att: ItemAttachment) {
  const url = await getSignedUrl(att.file_path);
  if (!url) {
    toast.error("生成预览链接失败");
    return null;
  }
  return url;
}

export async function downloadAttachment(att: ItemAttachment) {
  const blob = await downloadFile(att.file_path);
  if (!blob) {
    toast.error("下载失败");
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.file_name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
