import type { Item, HistoryEntry, ItemAttachment } from "@/lib/vault";

export const ITEM_LIST_COLUMNS =
  "id,name,category,tags,account,password_hint,phone,email,notes,extra,created_at,updated_at";
export const ITEM_FULL_COLUMNS = "*";
export const TRASH_COLUMNS = "id,name,category,deleted_at";
export const ATTACHMENT_COLUMNS = "id,file_name,file_path,mime_type,size";
export const ATTACHMENT_EXPORT_COLUMNS = "id,item_id,file_name,file_path,mime_type,size";

export type { Item, HistoryEntry, ItemAttachment };
