import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import {
  ChevronLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  History,
  Edit3,
  X,
  Paperclip,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCategory,
  maskValue,
  diffSnapshots,
  attachmentDiff,
  readField,
  FIELD_LABELS,
  type HistoryEntry,
  type SnapshotWithAttachments,
} from "@/lib/vault";
import {
  fetchItemById,
  updateItem,
  softDeleteItem,
  fetchHistory,
  deleteHistoryEntry as deleteHistoryEntryRepo,
  fetchAttachments,
} from "@/lib/repositories";
import type { Item, ItemAttachment } from "@/lib/repositories";
import { formatBytes } from "@/lib/format";
import { openAttachment, downloadAttachment } from "@/lib/attachments";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import FileTypeIcon, { mimeToLabel } from "@/components/FileTypeIcon";
import { AttachmentPreviewDialog } from "@/components/AttachmentPreviewDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemForm, itemToForm, type ItemFormValues } from "@/components/ItemForm";
import { confirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/items/$id")({
  component: ItemDetail,
});

const ACTION_LABEL: Record<string, string> = {
  create: "创建",
  update: "修改",
  delete: "移入回收站",
  restore: "还原",
};

const ACTION_COLOR: Record<string, string> = {
  create: "oklch(0.75 0.16 145)",
  update: "oklch(0.78 0.14 185)",
  delete: "oklch(0.68 0.22 25)",
  restore: "oklch(0.78 0.15 60)",
};

function ItemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { copied, copy } = useCopyToClipboard();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snapOpen, setSnapOpen] = useState<HistoryEntry | null>(null);
  const [previewAtt, setPreviewAtt] = useState<{ att: ItemAttachment; url: string } | null>(null);

  const { data: item, isLoading } = useQuery<Item | null>({
    queryKey: ["item", id],
    queryFn: () => fetchItemById(id),
  });

  const { data: history = [] } = useQuery<HistoryEntry[]>({
    queryKey: ["history", id],
    queryFn: () => fetchHistory(id),
  });

  const { data: attachments = [] } = useQuery<ItemAttachment[]>({
    queryKey: ["attachments", id],
    queryFn: () => fetchAttachments(id),
  });

  if (isLoading) return <DetailSkeleton />;
  if (!item) return <div className="py-16 text-center text-muted-foreground">条目不存在</div>;

  const cat = getCategory(item.category);

  async function moveToTrash() {
    const ok = await confirmDialog({
      title: "移入回收站？",
      description: "删除后可在回收站还原（7 天内有效）。",
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
    navigate({ to: "/items" });
  }

  async function handleDeleteHistoryEntry(h: HistoryEntry) {
    const ok = await confirmDialog({
      title: "删除该时间轴记录？",
      description: `将删除「${new Date(h.changed_at).toLocaleString("zh-CN")}」的历史快照，此操作无法撤销。`,
      confirmText: "删除记录",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteHistoryEntryRepo(h.id);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["history", id] });
    toast.success("已删除时间轴记录");
  }

  async function handleUpdate(v: ItemFormValues): Promise<void> {
    setSubmitting(true);
    try {
      await updateItem(id, {
        name: v.name.trim(),
        category: v.category,
        tags: v.tags,
        account: v.account || null,
        password_hint: v.password_hint || null,
        phone: v.phone || null,
        email: v.email || null,
        notes: v.notes || null,
        extra: v.extra ?? {},
      });
    } catch (e) {
      toast.error((e as Error).message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    qc.invalidateQueries({ queryKey: ["item", id] });
    qc.invalidateQueries({ queryKey: ["history", id] });
    qc.invalidateQueries({ queryKey: ["attachments", id] });
    qc.invalidateQueries({ queryKey: ["items"] });
    setEditing(false);
    toast.success("已更新");
  }

  async function handleOpenAttachment(att: ItemAttachment) {
    const url = await openAttachment(att);
    if (url) setPreviewAtt({ att, url });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/items"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
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
          <ItemHeader item={item} cat={cat} />
          <ItemFields cat={cat} item={item} copied={copied} onCopy={copy} />
          <ItemAttachments
            attachments={attachments}
            onPreview={handleOpenAttachment}
            onDownload={downloadAttachment}
          />
        </>
      )}

      <ItemTimeline
        history={history}
        onDeleteEntry={handleDeleteHistoryEntry}
        onOpenSnap={setSnapOpen}
      />

      <SnapshotDialog snapOpen={snapOpen} setSnapOpen={setSnapOpen} history={history} />

      <AttachmentPreviewDialog previewAtt={previewAtt} setPreviewAtt={setPreviewAtt} />
    </div>
  );
}

const ItemHeader = memo(function ItemHeader({
  item,
  cat,
}: {
  item: Item;
  cat: ReturnType<typeof getCategory>;
}) {
  return (
    <div className="panel-elevated p-6">
      <div className="flex items-start gap-4">
        <div
          className="grid h-14 w-14 place-items-center rounded-xl"
          style={{ background: `${cat.color}22`, color: cat.color }}
        >
          <cat.icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{item.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{cat.label}</span>
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-accent/40 px-1.5 py-0.5 text-[10px] text-accent-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function ItemFields({
  cat,
  item,
  copied,
  onCopy,
}: {
  cat: ReturnType<typeof getCategory>;
  item: Item;
  copied: string | null;
  onCopy: (k: string, v: string) => void;
}) {
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  return (
    <div className="panel p-6 space-y-3">
      <h3 className="mb-2 text-lg font-semibold">详细信息</h3>
      {cat.fields.map((f) => {
        const val = readField(item as SnapshotWithAttachments, f);
        if (!val) return null;
        if (f.type === "textarea") {
          return (
            <div key={f.key} className="rounded-md bg-surface-elevated p-3">
              <div className="mb-1 text-xs text-muted-foreground">{f.label}</div>
              <p className="whitespace-pre-wrap text-sm">{val}</p>
            </div>
          );
        }
        const shouldMask = f.masked || f.type === "password";
        return (
          <FieldRow
            key={f.key}
            label={f.label}
            value={val}
            k={f.key}
            copied={copied}
            onCopy={onCopy}
            masked={shouldMask && !reveal[f.key]}
            onToggle={
              shouldMask ? () => setReveal((r) => ({ ...r, [f.key]: !r[f.key] })) : undefined
            }
            hint={f.hint}
          />
        );
      })}
    </div>
  );
}

function ItemAttachments({
  attachments,
  onPreview,
  onDownload,
}: {
  attachments: ItemAttachment[];
  onPreview: (att: ItemAttachment) => void;
  onDownload: (att: ItemAttachment) => void;
}) {
  return (
    <div className="panel p-6 space-y-3">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Paperclip className="h-5 w-5 text-vault" /> 附件
        <span className="text-xs text-muted-foreground">{attachments.length} 个</span>
      </h3>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无附件</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded bg-surface-elevated px-3 py-2 text-sm"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-vault/10 text-[10px] font-mono text-vault">
                {mimeToLabel(a.mime_type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{a.file_name}</div>
                <div className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</div>
              </div>
              <button
                onClick={() => onPreview(a)}
                title="预览"
                className="rounded p-1 text-muted-foreground hover:text-vault"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDownload(a)}
                title="下载"
                className="rounded p-1 text-muted-foreground hover:text-vault"
              >
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemTimeline({
  history,
  onDeleteEntry,
  onOpenSnap,
}: {
  history: HistoryEntry[];
  onDeleteEntry: (h: HistoryEntry) => void;
  onOpenSnap: (h: HistoryEntry) => void;
}) {
  return (
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
          const { added, removed } = attachmentDiff(prev?.attachments, h.snapshot.attachments);
          return (
            <div key={h.id} className="group relative mb-4">
              <span
                className="absolute -left-4 top-6 h-3 w-3 rounded-full ring-4 ring-background"
                style={{ background: ACTION_COLOR[h.action] }}
              />
              <div className="flex items-stretch gap-2">
                <button
                  onClick={() => onOpenSnap(h)}
                  className="flex-1 rounded-lg border border-border/60 bg-surface-elevated/40 p-3 text-left hover:bg-surface-elevated"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: ACTION_COLOR[h.action] }}
                      >
                        {ACTION_LABEL[h.action] ?? h.action}
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
                        <span
                          key={f}
                          className="rounded bg-vault/10 px-1.5 py-0.5 text-[10px] text-vault"
                        >
                          {FIELD_LABELS[f] ?? f}
                        </span>
                      ))}
                      {added.length > 0 && (
                        <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-300">
                          +{added.length} 附件
                        </span>
                      )}
                      {removed.length > 0 && (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-300">
                          −{removed.length} 附件
                        </span>
                      )}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => onDeleteEntry(h)}
                  title="删除该时间轴记录"
                  className="rounded-lg border border-border/60 bg-surface-elevated/40 px-2 text-muted-foreground opacity-0 transition-opacity hover:border-destructive/40 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SnapshotDialog({
  snapOpen,
  setSnapOpen,
  history,
}: {
  snapOpen: HistoryEntry | null;
  setSnapOpen: (h: HistoryEntry | null) => void;
  history: HistoryEntry[];
}) {
  return (
    <Dialog open={!!snapOpen} onOpenChange={(o: boolean) => !o && setSnapOpen(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            快照 · {snapOpen && new Date(snapOpen.changed_at).toLocaleString("zh-CN")}
          </DialogTitle>
        </DialogHeader>
        {snapOpen &&
          (() => {
            const idx = history.findIndex((h) => h.id === snapOpen.id);
            const prev = history[idx + 1]?.snapshot ?? null;
            const changed = diffSnapshots(prev, snapOpen.snapshot);
            const { added, removed } = attachmentDiff(
              prev?.attachments,
              snapOpen.snapshot.attachments,
            );
            const snap = snapOpen.snapshot;
            const schema = getCategory(snap.category);
            const rows: [string, string, boolean][] = [
              ["name", snap.name, changed.has("name")],
              ["category", getCategory(snap.category).label, changed.has("category")],
              ["tags", (snap.tags ?? []).join(", ") || "—", changed.has("tags")],
              ...schema.fields.map<[string, string, boolean]>((f) => {
                const val = readField(snap, f) || "—";
                const isChanged = f.column ? changed.has(f.column) : changed.has("extra");
                return [f.key, val, isChanged];
              }),
            ];
            return (
              <div className="space-y-2">
                {rows.map(([k, v, isChanged]) => (
                  <div
                    key={k}
                    className={
                      "grid grid-cols-[9rem_1fr] gap-3 rounded-md px-3 py-2 text-sm " +
                      (isChanged ? "bg-vault/10 border border-vault/30" : "bg-surface-elevated/40")
                    }
                  >
                    <div className="text-xs text-muted-foreground">
                      {FIELD_LABELS[k] ?? schema.fields.find((f) => f.key === k)?.label ?? k}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{v}</div>
                  </div>
                ))}
                <div
                  className={
                    "rounded-md px-3 py-2 text-sm " +
                    (changed.has("attachments")
                      ? "bg-vault/10 border border-vault/30"
                      : "bg-surface-elevated/40")
                  }
                >
                  <div className="mb-1 text-xs text-muted-foreground">附件</div>
                  <div className="space-y-1">
                    {(snap.attachments ?? []).length === 0 && (
                      <div className="text-xs text-muted-foreground">（无）</div>
                    )}
                    {(snap.attachments ?? []).map((a) => {
                      const isNew = added.some((x) => x.id === a.id);
                      return (
                        <div
                          key={a.id}
                          className={
                            "flex items-center gap-2 text-xs " + (isNew ? "text-green-300" : "")
                          }
                        >
                          <Paperclip className="h-3 w-3" />
                          <span className="truncate">{a.file_name}</span>
                          {isNew && (
                            <span className="rounded bg-green-500/15 px-1 py-0.5 text-[10px]">
                              新增
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {removed.map((a) => (
                      <div
                        key={"r-" + a.id}
                        className="flex items-center gap-2 text-xs text-red-300 line-through"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate">{a.file_name}</span>
                        <span className="rounded bg-red-500/15 px-1 py-0.5 text-[10px] no-underline">
                          已移除
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {!prev && <p className="text-xs text-muted-foreground">这是首次创建的快照。</p>}
              </div>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label,
  value,
  k,
  copied,
  onCopy,
  masked,
  onToggle,
  hint,
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
      <div className="flex-1 font-mono text-sm">{masked ? maskValue(value) : value}</div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-vault"
          title={masked ? "显示" : "隐藏"}
        >
          {masked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      )}
      <button
        onClick={() => onCopy(k, value)}
        className="text-muted-foreground hover:text-vault"
        title="复制"
      >
        {copied === k ? <Check className="h-4 w-4 text-vault" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-6 w-24" />
      <div className="panel-elevated p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
      <div className="panel p-6 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
      <div className="panel p-6 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
