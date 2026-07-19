import { supabase } from "@/integrations/supabase/client";
import type { HistoryEntry } from "./types";

export async function fetchHistory(itemId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("item_history")
    .select("*")
    .eq("item_id", itemId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as HistoryEntry[];
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const { error } = await supabase.from("item_history").delete().eq("id", id);
  if (error) throw error;
}
