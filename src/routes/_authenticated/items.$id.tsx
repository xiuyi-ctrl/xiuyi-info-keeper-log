import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Copy, Check, Eye, EyeOff, Trash2, History, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCategory, maskValue, diffSnapshots, FIELD_LABELS,
  type Item, type HistoryEntry,
} from "@/lib/vault";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemForm, itemToForm, type ItemFormValues } from "@/components/ItemForm";

export const Route = createFileRoute("/_authenticated/items/$id")({
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snapOpen, setSnapOpen] = useState<HistoryEntry | null>(null);

  const { data: item, isLoading } = useQuery<Item | null>({
    queryKey: ["item", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Item | null;
    },
  });

  const { data: history = [] } = useQuery<HistoryEntry[]>({
    queryKey: ["history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_history")
        .select("*")
        .eq("item_id", id)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistoryEntry[];
    },
  });

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">加载中…</div>;
  if (!item) return <div className="py-16 text-center text-muted-foreground">条目不存在</div>;

  const cat = getCategory(item.category);

  async function copyText(k: string, v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(k);
      toast.success("已复制");
      setTimeout(() => setCopied(null), 1500);
    } catch { toast.error("复制失败"); }
  }

  async function moveToTrash() {
    if (!confirm("确定删除吗？删除后可在回收站还原（7 天）")) return;
    const { error } = await supabase.from("items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["items"] });
    toast.success("已移入回收站");
    navigate({ to: "/items" });
  }

  async function handleUpdate(v: ItemFormValues) {
    setSubmitting(true);
    const { error } = await supabase.from("items").update({
      name: v.name.trim(),
      category: v.category,
      tags: v.tags,
      account: v.account || null,
      password_hint: v.password_hint || null,
      phone: v.phone || null,
      email: v.email || null,
      notes: v.notes || null,
    }).eq("id", id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["item", id] });
    qc.invalidateQueries({ queryKey: ["history", id] });
    qc.invalidateQueries({ queryKey: ["items"] });
    setEditing(false);
    toast.success("已更新");
  }

  const actionLabel: Record<string, string> = {
    create: "创建", update: "修改", delete: "移入回收站", restore: "还原",
  };
  const actionColor: Record<string, string> = {
    create: "oklch(0.75 0.16 145)",
    update: "oklch(0.78 0.14 185)",
    delete: "oklch(0.68 0.22 25)",
    restore: "oklch(0.78 0.15 60)",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/items" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> 返回列表
        </Link>
        <div className="flex gap-2">
          {editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X className="mr-1 h-4 w-4" /> 取消
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit3 className="mr-1 h-4 w-4" /> 编辑
              </Button>
              <Button variant="destructive" size="sm" onClick={moveToTrash}>
                <Trash2 className="mr-1 h-4 w-4" /> 删除
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <ItemForm
          initial={itemToForm(item)}
          itemId={item.id}
          onSubmit={handleUpdate}
          submitting={submitting}
          submitLabel="保存修改"
        />
      ) : (
        <>
          <div className="panel-elevated p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl" style={{ background: `${cat.color}22`, color: cat.color }}>
                <cat.icon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold">{item.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{cat.label}</span>
                  {item.tags.map((t) => (
                    <span key={t} className="rounded bg-accent/40 px-1.5 py-0.5 text-[10px] text-accent-foreground">#{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-6 space-y-3">
            <h3 className="mb-2 text-lg font-semibold">详细信息</h3>
            <FieldRow label="账号 / 用户名" value={item.account} k="account" copied={copied} onCopy={copyText} />
            <FieldRow
              label="密码提示词"
              value={item.password_hint}
              k="hint"
              copied={copied}
              onCopy={copyText}
              masked={!reveal.hint}
              onToggle={() => setReveal((r) => ({ ...r, hint: !r.hint }))}
              hint="非明文，仅提示"
            />
            <FieldRow label="绑定手机号" value={item.phone} k="phone" copied={copied} onCopy={copyText} />
            <FieldRow label="绑定邮箱" value={item.email} k="email" copied={copied} onCopy={copyText} />
            {item.notes && (
              <div className="rounded-md bg-surface-elevated p-3">
                <div className="mb-1 text-xs text-muted-foreground">备注</div>
                <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
              </div>
            )}
          </div>
        </>
      )}

      <div className="panel p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <History className="h-5 w-5 text-vault" /> 修改历程时间轴
          <span className="text-xs text-muted-foreground">共 {history.length} 次变更</span>
        </h3>
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          {history.map((h, i) => {
            const prev = history[i + 1]?.snapshot ?? null;
            const changed = diffSnapshots(prev, h.snapshot);
            return (
              <button
                key={h.id}
                onClick={() => setSnapOpen(h)}
                className="group relative mb-4 block w-full rounded-lg border border-border/60 bg-surface-elevated/40 p-3 text-left hover:bg-surface-elevated"
              >
                <span
                  className="absolute -left-4 top-4 h-3 w-3 rounded-full ring-4 ring-background"
                  style={{ background: actionColor[h.action] }}
                />
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium" style={{ color: actionColor[h.action] }}>
                      {actionLabel[h.action] ?? h.action}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(h.changed_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  {changed.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {changed.size} 个字段变更
                    </span>
                  )}
                </div>
                {changed.size > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Array.from(changed).map((f) => (
                      <span key={f} className="rounded bg-vault/10 px-1.5 py-0.5 text-[10px] text-vault">
                        {FIELD_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!snapOpen} onOpenChange={(o) => !o && setSnapOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              快照 · {snapOpen && new Date(snapOpen.changed_at).toLocaleString("zh-CN")}
            </DialogTitle>
          </DialogHeader>
          {snapOpen && (() => {
            const idx = history.findIndex((h) => h.id === snapOpen.id);
            const prev = history[idx + 1]?.snapshot ?? null;
            const changed = diffSnapshots(prev, snapOpen.snapshot);
            const snap = snapOpen.snapshot;
            const rows: [string, unknown][] = [
              ["name", snap.name], ["category", getCategory(snap.category).label],
              ["tags", (snap.tags ?? []).join(", ") || "—"],
              ["account", snap.account || "—"],
              ["password_hint", snap.password_hint || "—"],
              ["phone", snap.phone || "—"],
              ["email", snap.email || "—"],
              ["notes", snap.notes || "—"],
            ];
            return (
              <div className="space-y-2">
                {rows.map(([k, v]) => {
                  const isChanged = changed.has(k);
                  return (
                    <div
                      key={k}
                      className={
                        "grid grid-cols-[9rem_1fr] gap-3 rounded-md px-3 py-2 text-sm " +
                        (isChanged ? "bg-vault/10 border border-vault/30" : "bg-surface-elevated/40")
                      }
                    >
                      <div className="text-xs text-muted-foreground">{FIELD_LABELS[k] ?? k}</div>
                      <div className="whitespace-pre-wrap break-words">{String(v)}</div>
                    </div>
                  );
                })}
                {!prev && <p className="text-xs text-muted-foreground">这是首次创建的快照。</p>}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldRow({
  label, value, k, copied, onCopy, masked, onToggle, hint,
}: {
  label: string;
  value: string | null;
  k: string;
  copied: string | null;
  onCopy: (k: string, v: string) => void;
  masked?: boolean;
  onToggle?: () => void;
  hint?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface-elevated px-4 py-2.5">
      <div className="w-28 shrink-0 text-xs text-muted-foreground">
        {label}
        {hint && <div className="text-[10px] opacity-70">{hint}</div>}
      </div>
      <div className="flex-1 font-mono text-sm">
        {masked ? maskValue(value) : value}
      </div>
      {onToggle && (
        <button onClick={onToggle} className="text-muted-foreground hover:text-vault" title={masked ? "显示" : "隐藏"}>
          {masked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      )}
      <button onClick={() => onCopy(k, value)} className="text-muted-foreground hover:text-vault" title="复制">
        {copied === k ? <Check className="h-4 w-4 text-vault" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
