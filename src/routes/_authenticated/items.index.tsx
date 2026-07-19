import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Eye, EyeOff, Copy, Check, Plus, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getCategory,
  getAllCategories,
  maskValue,
  readField,
  removeCustomCategory,
  type SnapshotWithAttachments,
} from "@/lib/vault";
import {
  fetchActiveItems,
  softDeleteItem,
  bulkSoftDeleteByCategory,
  fetchAttachmentsForExport,
} from "@/lib/repositories";
import type { Item, ItemAttachment } from "@/lib/repositories";
import { formatBytes, formatDT } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/items/")({
  component: ItemsList,
});

function ItemsList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [cats, setCats] = useState(getAllCategories());

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["items", "all"],
    queryFn: fetchActiveItems,
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (tag !== "all" && !(i.tags ?? []).includes(tag)) return false;
      if (!query) return true;
      return i.name.toLowerCase().includes(query) || (i.notes ?? "").toLowerCase().includes(query);
    });
  }, [items, q, cat, tag]);

  async function copyText(id: string, v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(id);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("复制失败");
    }
  }

  async function moveToTrash(id: string, name: string) {
    const ok = await confirmDialog({
      title: "移入回收站？",
      description: `将删除「${name}」，删除后可在回收站还原（7 天内有效）。`,
      confirmText: "移入回收站",
      destructive: true,
    });
    if (!ok) return;
    try {
      await softDeleteItem(id);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["items"] });
    toast.success("已移入回收站");
  }

  async function deleteCustomCategory(key: string, label: string) {
    const count = items.filter((i) => i.category === key).length;
    const ok = await confirmDialog({
      title: `删除自定义分类「${label}」`,
      description:
        count > 0
          ? `该分类下共有 ${count} 条信息，删除分类会同时将这些信息移入回收站（7 天内仍可还原）。确认继续？`
          : `分类「${label}」当前没有条目，将从列表中移除。`,
      confirmText: "删除分类",
      destructive: true,
    });
    if (!ok) return;
    if (count > 0) {
      try {
        await bulkSoftDeleteByCategory(key);
      } catch (e) {
        toast.error("删除失败", { description: (e as Error).message });
        return;
      }
    }
    removeCustomCategory(key);
    setCats(getAllCategories());
    if (cat === key) setCat("all");
    qc.invalidateQueries({ queryKey: ["items"] });
    toast.success(`已删除分类「${label}」`);
  }

  async function exportExcel() {
    if (cat === "all") {
      toast.info("请先选择一个具体分类再导出");
      return;
    }
    if (filtered.length === 0) {
      toast.info("当前筛选没有可导出的条目");
      return;
    }
    const XLSX = await import("xlsx");
    const schema = getCategory(cat);
    const ids = filtered.map((i) => i.id);
    const attData = await fetchAttachmentsForExport(ids);
    const attMap = new Map<string, ItemAttachment[]>();
    attData.forEach((a) => {
      const list = attMap.get(a.item_id) ?? [];
      list.push(a);
      attMap.set(a.item_id, list);
    });

    const headers = [
      "名称",
      "分类",
      "标签",
      ...schema.fields.map((f) => f.label),
      "附件数量",
      "附件列表",
      "创建时间",
      "更新时间",
    ];
    const rows = filtered.map((it) => {
      const atts = attMap.get(it.id) ?? [];
      const base = [it.name, schema.label, (it.tags ?? []).map((t) => "#" + t).join(" ")];
      const dyn = schema.fields.map((f) => readField(it as SnapshotWithAttachments, f));
      const attList = atts.map((a) => `${a.file_name} (${formatBytes(a.size)})`).join("\n");
      return [
        ...base,
        ...dyn,
        atts.length,
        attList,
        formatDT(it.created_at),
        formatDT(it.updated_at),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, Math.min(50, h.length * 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, schema.label.slice(0, 30));
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `信息保险箱_${schema.label}_${stamp}.xlsx`);
    toast.success(`已导出 ${filtered.length} 条 ${schema.label}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">全部条目</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {filtered.length} 条</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportExcel}
            disabled={cat === "all" || filtered.length === 0}
            title={cat === "all" ? "请先选择一个分类" : "导出当前分类为 Excel"}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" /> 批量导出 Excel
          </Button>
          <Link to="/items/new">
            <Button className="gradient-accent-bg text-primary-foreground">
              <Plus className="mr-1 h-4 w-4" /> 新建条目
            </Button>
          </Link>
        </div>
      </div>

      <div className="panel p-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="全局秒搜：按名称或备注模糊搜索…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            全部分类
          </Chip>
          {cats.map((c) => (
            <div key={c.key} className="group inline-flex items-center">
              <Chip active={cat === c.key} onClick={() => setCat(c.key)} color={c.color}>
                <c.icon className="mr-1 h-3.5 w-3.5" /> {c.label}
              </Chip>
              {!c.builtin && (
                <button
                  type="button"
                  onClick={() => deleteCustomCategory(c.key, c.label)}
                  title="删除该自定义分类"
                  className="ml-0.5 rounded-full p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={tag === "all"} onClick={() => setTag("all")}>
              全部标签
            </Chip>
            {allTags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
                #{t}
              </Chip>
            ))}
          </div>
        )}
        {cat !== "all" && (
          <p className="text-xs text-muted-foreground">
            提示：选择分类后可导出该分类下所有条目为 Excel 文件（含全部字段与附件信息）。
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="panel py-20 text-center">
          <p className="text-muted-foreground">没有匹配的记录</p>
          <Link to="/items/new" className="mt-4 inline-block text-vault hover:underline">
            新建第一条 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) => {
            const c = getCategory(it.category);
            const isRevealed = reveal[it.id];
            const isParty = it.category === "party";
            const partyTime = isParty ? String((it.extra ?? {})["time"] ?? "") : "";
            const partyIntro = isParty ? String((it.extra ?? {})["introducer"] ?? "") : "";
            return (
              <div
                key={it.id}
                className="panel group relative flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => moveToTrash(it.id, it.name)}
                  title="删除"
                  className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/items/$id"
                    params={{ id: it.id }}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-md"
                      style={{ background: `${c.color}22`, color: c.color }}
                    >
                      <c.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{it.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                    </div>
                  </Link>
                </div>

                {isParty && (partyTime || partyIntro) && (
                  <div className="space-y-1.5">
                    {partyTime && (
                      <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground shrink-0">时间</span>
                        <span className="flex-1 truncate text-xs">{partyTime}</span>
                      </div>
                    )}
                    {partyIntro && (
                      <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground shrink-0">介绍人</span>
                        <span className="flex-1 truncate text-xs">{partyIntro}</span>
                      </div>
                    )}
                  </div>
                )}

                {it.account && (
                  <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground shrink-0">账号</span>
                    <span className="flex-1 truncate font-mono text-xs">{it.account}</span>
                    <button
                      onClick={() => copyText(it.id + "acc", it.account!)}
                      className="text-muted-foreground hover:text-vault"
                      title="复制账号"
                    >
                      {copied === it.id + "acc" ? (
                        <Check className="h-3.5 w-3.5 text-vault" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {it.password_hint && (
                  <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground shrink-0">提示词</span>
                    <span className="flex-1 truncate font-mono text-xs">
                      {isRevealed ? it.password_hint : maskValue(it.password_hint)}
                    </span>
                    <button
                      onClick={() => setReveal((r) => ({ ...r, [it.id]: !r[it.id] }))}
                      className="text-muted-foreground hover:text-vault"
                      title={isRevealed ? "隐藏" : "显示"}
                    >
                      {isRevealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {it.tags && it.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {it.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-accent/40 px-1.5 py-0.5 text-[10px] text-accent-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  color,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-vault/60 bg-vault/10 text-vault"
          : "border-border bg-surface text-muted-foreground hover:text-foreground")
      }
      style={
        active && color ? { borderColor: color + "80", color, background: color + "18" } : undefined
      }
    >
      {children}
    </button>
  );
}
