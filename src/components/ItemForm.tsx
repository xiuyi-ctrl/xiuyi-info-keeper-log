import { useState, useEffect } from "react";
import { X, Plus, Upload, AlertTriangle, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAllCategories,
  addCustomCategory,
  DEFAULT_TAGS,
  MAX_CUSTOM_FIELDS,
  type FieldDef,
  type FieldType,
  type ItemAttachment,
} from "@/lib/vault";
import { fetchAttachments, uploadAttachment, deleteAttachment } from "@/lib/repositories";
import { formatBytes } from "@/lib/format";
import { openAttachment, downloadAttachment } from "@/lib/attachments";
import FileTypeIcon from "@/components/FileTypeIcon";
import AttachmentPreview, { AttachmentPreviewLink } from "@/components/AttachmentPreview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ConfirmDialog";

export type ItemFormValues = {
  name: string;
  category: string;
  tags: string[];
  account: string;
  password_hint: string;
  phone: string;
  email: string;
  notes: string;
  extra: Record<string, string>;
};

export function itemToForm(item: Item): ItemFormValues {
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(item.extra ?? {})) {
    extra[k] = v == null ? "" : String(v);
  }
  return {
    name: item.name,
    category: item.category,
    tags: item.tags ?? [],
    account: item.account ?? "",
    password_hint: item.password_hint ?? "",
    phone: item.phone ?? "",
    email: item.email ?? "",
    notes: item.notes ?? "",
    extra,
  };
}

export const emptyForm: ItemFormValues = {
  name: "",
  category: "account",
  tags: [],
  account: "",
  password_hint: "",
  phone: "",
  email: "",
  notes: "",
  extra: {},
};

export function ItemForm({
  initial,
  itemId,
  onSubmit,
  submitting,
  submitLabel,
}: {
  initial: ItemFormValues;
  itemId?: string;
  onSubmit: (v: ItemFormValues) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [tagInput, setTagInput] = useState("");
  const [cats, setCats] = useState(() => getAllCategories());
  const [attachments, setAttachments] = useState<ItemAttachment[]>([]);
  const [previewAtt, setPreviewAtt] = useState<{ att: ItemAttachment; url: string } | null>(null);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    fetchAttachments(itemId).then(setAttachments);
  }, [itemId]);

  useEffect(() => {
    setCats(getAllCategories());
  }, [showCatDialog]);

  const currentSchema = cats.find((c) => c.key === values.category) ?? cats[cats.length - 1];

  function update<K extends keyof ItemFormValues>(k: K, v: ItemFormValues[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  function setFieldValue(f: FieldDef, v: string) {
    if (f.column) {
      update(f.column, v);
    } else {
      setValues((s) => ({ ...s, extra: { ...s.extra, [f.key]: v } }));
    }
  }
  function getFieldValue(f: FieldDef): string {
    if (f.column) return values[f.column] ?? "";
    return values.extra[f.key] ?? "";
  }

  function addTag(t?: string) {
    const raw = (t ?? tagInput).trim().replace(/^#/, "");
    if (!raw) return;
    if (!values.tags.includes(raw)) update("tags", [...values.tags, raw]);
    setTagInput("");
  }

  function handleCategoryCreated(key: string) {
    setCats(getAllCategories());
    update("category", key);
    // Reset extra so new schema starts blank
    setValues((s) => ({ ...s, extra: {} }));
    setShowCatDialog(false);
    toast.success("自定义分类已添加");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !itemId) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`文件「${file.name}」超过 10MB，已跳过`);
        continue;
      }

      const path = `${userData.user.id}/${itemId}/${Date.now()}-${file.name}`;
      try {
        const att = await uploadAttachment({
          userId: userData.user.id,
          itemId,
          file,
          path,
        });
        setAttachments((a) => [...a, att]);
        successCount++;
      } catch (err) {
        toast.error(`上传「${file.name}」失败`, { description: (err as Error).message });
      }
    }

    setUploading(false);
    if (successCount > 0) toast.success(`已上传 ${successCount} 个附件`);
    e.target.value = "";
  }

  async function removeAttachment(att: ItemAttachment) {
    const ok = await confirmDialog({
      title: "删除附件？",
      description: `将删除附件「${att.file_name}」，此操作无法撤销。`,
      confirmText: "删除",
      destructive: true,
    });
    if (!ok) return;
    await deleteAttachment(att);
    setAttachments((a) => a.filter((x) => x.id !== att.id));
    toast.success("已删除附件");
  }

  async function handleOpenAttachment(att: ItemAttachment) {
    const url = await openAttachment(att);
    if (url) setPreviewAtt({ att, url });
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!values.name.trim()) return toast.error("请填写名称");
        await onSubmit(values);
      }}
      className="space-y-6"
    >
      <div className="panel p-6 space-y-4">
        <h3 className="text-lg font-semibold">基础信息</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              required
              maxLength={100}
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>分类</Label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    update("category", c.key);
                    if (c.key !== values.category)
                      setValues((s) => ({ ...s, category: c.key, extra: {} }));
                  }}
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs " +
                    (values.category === c.key
                      ? "border-vault/60 bg-vault/10 text-vault"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground")
                  }
                >
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCatDialog(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:text-vault hover:border-vault/60"
              >
                <Plus className="h-3 w-3" /> 新增自定义分类
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>二级标签</Label>
          <div className="flex flex-wrap items-center gap-2">
            {values.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded bg-accent/40 px-2 py-1 text-xs"
              >
                #{t}
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "tags",
                      values.tags.filter((x) => x !== t),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="flex gap-1">
              <Input
                placeholder="输入后回车"
                maxLength={20}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="h-8 w-40 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => addTag()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <span>常用：</span>
            {DEFAULT_TAGS.map((t) => {
              const active = values.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    active
                      ? update(
                          "tags",
                          values.tags.filter((x) => x !== t),
                        )
                      : addTag(t)
                  }
                  className={
                    "rounded-full border px-2 py-0.5 " +
                    (active
                      ? "border-vault/60 bg-vault/10 text-vault"
                      : "border-border bg-surface hover:text-foreground")
                  }
                >
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">详细字段</h3>
          <span className="text-xs text-muted-foreground">
            {currentSchema.label} · {currentSchema.fields.length} 项
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {currentSchema.fields
            .filter((f) => f.type !== "textarea")
            .map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>
                  {f.label}
                  {f.hint && <span className="ml-2 text-xs text-muted-foreground">{f.hint}</span>}
                </Label>
                <Input
                  id={f.key}
                  type={
                    f.type === "date"
                      ? "date"
                      : f.type === "email"
                        ? "email"
                        : f.type === "tel"
                          ? "tel"
                          : f.type === "password"
                            ? "password"
                            : "text"
                  }
                  autoComplete={f.type === "password" ? "new-password" : undefined}
                  value={getFieldValue(f)}
                  onChange={(e) => setFieldValue(f, e.target.value)}
                />
              </div>
            ))}
        </div>
        {currentSchema.fields
          .filter((f) => f.type === "textarea")
          .map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Textarea
                id={f.key}
                rows={4}
                value={getFieldValue(f)}
                onChange={(e) => setFieldValue(f, e.target.value)}
              />
            </div>
          ))}
      </div>

      <div className="panel p-6 space-y-3">
        <h3 className="text-lg font-semibold">附件</h3>
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          附件用于保存二维码截图或配置文件。请勿上传明文密码或其他不必要的敏感文件。
        </div>
        {!itemId ? (
          <p className="text-sm text-muted-foreground">保存后可上传附件。</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label
                className={
                  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated" +
                  (uploading ? " pointer-events-none opacity-60" : "")
                }
              >
                {uploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "上传中…" : "上传附件"}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              <span className="text-xs text-muted-foreground">
                支持多选 · 单个 ≤ 10MB · 图片 / PDF / 文档等
              </span>
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded bg-surface-elevated px-3 py-2 text-sm"
                  >
                    <FileTypeIcon mime={a.mime_type} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.file_name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</div>
                    </div>
                    <button
                      type="button"
                      title="预览"
                      onClick={() => handleOpenAttachment(a)}
                      className="rounded p-1 text-muted-foreground hover:text-vault"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="下载"
                      onClick={() => downloadAttachment(a)}
                      className="rounded p-1 text-muted-foreground hover:text-vault"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => removeAttachment(a)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={submitting}
          className="gradient-accent-bg text-primary-foreground"
        >
          {submitting ? "保存中…" : submitLabel}
        </Button>
      </div>

      <NewCategoryDialog
        open={showCatDialog}
        onOpenChange={setShowCatDialog}
        onCreated={handleCategoryCreated}
      />

      <Dialog open={!!previewAtt} onOpenChange={(o) => !o && setPreviewAtt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <span className="truncate">{previewAtt?.att.file_name}</span>
              {previewAtt && <AttachmentPreviewLink att={previewAtt.att} url={previewAtt.url} />}
            </DialogTitle>
          </DialogHeader>
          {previewAtt && <AttachmentPreview att={previewAtt.att} url={previewAtt.url} />}
          <DialogFooter>
            {previewAtt && (
              <Button variant="outline" onClick={() => downloadAttachment(previewAtt.att)}>
                <Download className="mr-1 h-4 w-4" /> 下载
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function NewCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<{ key: string; label: string; type: FieldType }[]>([]);

  function addField() {
    if (fields.length >= MAX_CUSTOM_FIELDS)
      return toast.error(`最多 ${MAX_CUSTOM_FIELDS} 个自定义字段`);
    setFields((s) => [
      ...s,
      { key: `f_${Date.now().toString(36)}_${s.length}`, label: "", type: "text" },
    ]);
  }

  function save() {
    if (!label.trim()) return toast.error("请输入分类名");
    const cleaned = fields.filter((f) => f.label.trim());
    try {
      const key = addCustomCategory(label.trim(), cleaned);
      setLabel("");
      setFields([]);
      onCreated(key);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新增自定义分类</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>分类名称</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例：车辆信息 / 保险单"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                自定义字段{" "}
                <span className="text-xs text-muted-foreground">
                  最多 {MAX_CUSTOM_FIELDS} 个，备注字段自动包含
                </span>
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="mr-1 h-3 w-3" /> 添加字段
              </Button>
            </div>
            {fields.map((f, i) => (
              <div
                key={f.key}
                className="flex items-center gap-2 rounded-md bg-surface-elevated p-2"
              >
                <Input
                  placeholder={`字段名 ${i + 1}`}
                  value={f.label}
                  onChange={(e) =>
                    setFields((s) =>
                      s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  className="h-8 flex-1"
                />
                <select
                  value={f.type}
                  onChange={(e) =>
                    setFields((s) =>
                      s.map((x, j) => (j === i ? { ...x, type: e.target.value as FieldType } : x)),
                    )
                  }
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                >
                  <option value="text">文本</option>
                  <option value="textarea">多行</option>
                  <option value="date">日期</option>
                  <option value="password">密码</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFields((s) => s.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="rounded-md border border-dashed border-border/60 bg-surface-elevated/40 px-3 py-2 text-xs text-muted-foreground">
              备注（自动）
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={save} className="gradient-accent-bg text-primary-foreground">
            保存分类
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
