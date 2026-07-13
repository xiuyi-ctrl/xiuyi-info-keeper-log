import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCategory, daysRemainingInTrash, TRASH_RETENTION_DAYS, type Item } from "@/lib/vault";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/trash")({
  component: TrashPage,
});

function TrashPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["items", "trash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  // Auto-purge items older than 7 days on view (client-side sweep)
  useEffect(() => {
    if (!items.length) return;
    const expired = items.filter((i) => i.deleted_at && daysRemainingInTrash(i.deleted_at) === 0);
    if (expired.length === 0) return;
    (async () => {
      const ids = expired.map((e) => e.id);
      await supabase.from("items").delete().in("id", ids);
      qc.invalidateQueries({ queryKey: ["items"] });
    })();
  }, [items, qc]);

  async function restore(id: string) {
    const { error } = await supabase.from("items").update({ deleted_at: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已还原");
    qc.invalidateQueries({ queryKey: ["items"] });
  }

  async function purge(id: string) {
    const ok = await confirmDialog({
      title: "彻底删除？",
      description: "彻底删除后无法恢复，确定继续？",
      confirmText: "彻底删除",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已彻底删除");
    qc.invalidateQueries({ queryKey: ["items"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">回收站</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          删除的记录保留 {TRASH_RETENTION_DAYS} 天，超期自动清除；期间可一键还原。
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">加载中…</div>
      ) : items.length === 0 ? (
        <div className="panel py-20 text-center text-muted-foreground">回收站是空的</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const c = getCategory(it.category);
            const days = daysRemainingInTrash(it.deleted_at!);
            return (
              <div key={it.id} className="panel flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md" style={{ background: `${c.color}22`, color: c.color }}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.label} · 还剩 <span className="text-vault">{days}</span> 天
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => restore(it.id)}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> 还原
                </Button>
                <Button size="sm" variant="destructive" onClick={() => purge(it.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
