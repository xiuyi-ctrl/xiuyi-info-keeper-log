import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ItemAttachment } from "@/lib/vault";

export async function openAttachment(att: ItemAttachment) {
  const { data, error } = await supabase.storage
    .from("vault-attachments")
    .createSignedUrl(att.file_path, 60 * 10);
  if (error || !data) return toast.error("生成预览链接失败");
  return data.signedUrl;
}

export async function downloadAttachment(att: ItemAttachment) {
  const { data, error } = await supabase.storage.from("vault-attachments").download(att.file_path);
  if (error || !data) return toast.error("下载失败");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.file_name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
