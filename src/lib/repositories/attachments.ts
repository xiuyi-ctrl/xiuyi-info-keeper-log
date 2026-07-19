import { supabase } from "@/integrations/supabase/client";
import type { ItemAttachment } from "./types";
import { ATTACHMENT_COLUMNS, ATTACHMENT_EXPORT_COLUMNS } from "./types";

export async function fetchAttachments(itemId: string): Promise<ItemAttachment[]> {
  const { data, error } = await supabase
    .from("item_attachments")
    .select(ATTACHMENT_COLUMNS)
    .eq("item_id", itemId);
  if (error) throw error;
  return (data ?? []) as ItemAttachment[];
}

export async function fetchAttachmentsForExport(
  itemIds: string[],
): Promise<(ItemAttachment & { item_id: string })[]> {
  const { data, error } = await supabase
    .from("item_attachments")
    .select(ATTACHMENT_EXPORT_COLUMNS)
    .in("item_id", itemIds);
  if (error) throw error;
  return (data ?? []) as (ItemAttachment & { item_id: string })[];
}

export async function uploadAttachment(params: {
  userId: string;
  itemId: string;
  file: File;
  path: string;
}): Promise<ItemAttachment> {
  const { userId, itemId, file, path } = params;
  const up = await supabase.storage.from("vault-attachments").upload(path, file);
  if (up.error) throw up.error;
  const { data, error } = await supabase
    .from("item_attachments")
    .insert({
      item_id: itemId,
      user_id: userId,
      file_name: file.name,
      file_path: path,
      size: file.size,
      mime_type: file.type,
    })
    .select(ATTACHMENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as ItemAttachment;
}

export async function deleteAttachment(att: ItemAttachment): Promise<void> {
  await supabase.storage.from("vault-attachments").remove([att.file_path]);
  const { error } = await supabase.from("item_attachments").delete().eq("id", att.id);
  if (error) throw error;
}

export async function getSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("vault-attachments")
    .createSignedUrl(filePath, 60 * 10);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function downloadFile(filePath: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from("vault-attachments").download(filePath);
  if (error || !data) return null;
  return data;
}
