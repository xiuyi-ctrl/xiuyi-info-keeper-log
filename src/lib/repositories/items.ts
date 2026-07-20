import { supabase } from "@/integrations/supabase/client";
import type { Item } from "./types";
import { ITEM_LIST_COLUMNS, ITEM_FULL_COLUMNS, TRASH_COLUMNS } from "./types";

export async function fetchActiveItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_LIST_COLUMNS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function fetchItemById(id: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Item) ?? null;
}

export async function createItem(data: {
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
}): Promise<string> {
  const { data: result, error } = await supabase.from("items").insert(data).select("id").single();
  if (error) throw error;
  return result.id;
}

export async function updateItem(
  id: string,
  data: {
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
): Promise<void> {
  const { error } = await supabase.from("items").update(data).eq("id", id);
  if (error) throw error;
}

export async function softDeleteItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function bulkSoftDeleteByCategory(category: string): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("category", category)
    .is("deleted_at", null);
  if (error) throw error;
}

export async function fetchTrashedItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select(TRASH_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function restoreItem(id: string): Promise<void> {
  const { error } = await supabase.from("items").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export async function purgeItem(id: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function purgeExpiredTrash(): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const { data, error } = await supabase
    .from("items")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff.toISOString());
  if (error) throw error;
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return [];
  const { error: delError } = await supabase.from("items").delete().in("id", ids);
  if (delError) throw delError;
  return ids;
}
