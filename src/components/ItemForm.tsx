import { useState, useEffect } from "react";
import { X, Plus, Upload, AlertTriangle, Download, Eye, Trash, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAllCategories, addCustomCategory, removeCustomCategory,
  getCategory, DEFAULT_TAGS, MAX_CUSTOM_FIELDS,
  type Item, type FieldDef, type FieldType, type ItemAttachment,
} from "@/lib/vault";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  const [cats, setCats] = useState(getAllCategories());
  const [attachments, setAttachments] = useState<ItemAttachment[]>([]);
  const [previewAtt, setPreviewAtt] = useState<{ att: ItemAttachment; url: string } | null>(null);
  const [showCatDialog, setShowCatDialog] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    supabase
      .from("item_attachments")
      .select("id,file_name,file_path,mime_type,size")
      .eq("item_id", itemId)
      .then(({ data }) => setAttachments((data as ItemAttachment[]) ?? []));
  }, [itemId]);

  const currentSchema = getCategory(values.category);

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

  async function deleteCustomCategory(key: string, label: string) {
    if (!confirm(`删除自定义分类「${label}」将同时把该分类下的所有条目移入回收站，确认继续？`)) return;
    const { error } = await supabase
      .from("items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("category", key)
      .is("deleted_at", null);
    if (error) return toast.error("删除失败", { description: error.message });
    removeCustomCategory(key);
    setCats(getAllCategories());
    if (values.category === key) setValues((s) => ({ ...s, category: "other", extra: {} }));
    toast.success(`已删除分类「${label}」，相关条目已移入回收站`);
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
    const file = e.target.files?.[0];
    if (!file || !itemId) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("文件超过 10MB");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const path = `${userData.user.id}/${itemId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("vault-attachments").upload(path, file);
    if (up.error) return toast.error("上传失败", { description: up.error.message });

    const ins = await supabase
      .from("item_attachments")
      .insert({
        item_id: itemId,
        user_id: userData.user.id,
        file_name: file.name,
        file_path: path,
        size: file.size,
        mime_type: file.type,
      })
      .select("id,file_name,file_path,mime_type,size")
      .single();

    if (ins.error) return toast.error(ins.error.message);
    if (ins.data) setAttachments((a) => [...a, ins.data as ItemAttachment]);
    toast.success("附件已上传");
    e.target.value = "";
  }

  async function removeAttachment(att: ItemAttachment) {
    if (!confirm(`删除附件 ${att.file_name}？`)) return;
    await supabase.storage.from("vault-attachments").remove([att.file_path]);
    await supabase.from("item_attachments").delete().eq("id", att.id);
    setAttachments((a) => a.filter((x) => x.id !== att.id));
    toast.success("已删除附件");
  }

  async function openAttachment(att: ItemAttachment) {
    const { data, error } = await supabase.storage.from("vault-attachments").createSignedUrl(att.file_path, 60 * 10);
    if (error || !data) return toast.error("生成预览链接失败");
    setPreviewAtt({ att, url: data.signedUrl });
  }

  async function downloadAttachment(att: ItemAttachment) {
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
            <Input id="name" required value={values.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>分类</Label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <div key={c.key} className="group inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      update("category", c.key);
                      if (c.key !== values.category) setValues((s) => ({ ...s, category: c.key, extra: {} }));
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
                  {!c.builtin && (
                    <button
                      type="button"
                      onClick={() => deleteCustomCategory(c.key, c.label)}
                      title="删除该自定义分类"
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  )}

                </div>
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
              <span key={t} className="inline-flex items-center gap-1 rounded bg-accent/40 px-2 py-1 text-xs">
                #{t}
                <button type="button" onClick={() => update("tags", values.tags.filter((x) => x !== t))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="flex gap-1">
              <Input
                placeholder="输入后回车"
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
                  onClick={() => active
                    ? update("tags", values.tags.filter((x) => x !== t))
                    : addTag(t)}
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
          <span className="text-xs text-muted-foreground">{currentSchema.label} · {currentSchema.fields.length} 项</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {currentSchema.fields.filter((f) => f.type !== "textarea").map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>
                {f.label}
                {f.hint && <span className="ml-2 text-xs text-muted-foreground">{f.hint}</span>}
              </Label>
              <Input
                id={f.key}
                type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                value={getFieldValue(f)}
                onChange={(e) => setFieldValue(f, e.target.value)}
              />
            </div>
          ))}
        </div>
        {currentSchema.fields.filter((f) => f.type === "textarea").map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Textarea id={f.key} rows={4} value={getFieldValue(f)} onChange={(e) => setFieldValue(f, e.target.value)} />
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
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated">
                <Upload className="h-4 w-4" /> 上传附件
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
              <span className="text-xs text-muted-foreground">单个 ≤ 10MB · 支持图片 / PDF / 文档等</span>
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded bg-surface-elevated px-3 py-2 text-sm">
                    <FileTypeIcon mime={a.mime_type} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.file_name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</div>
                    </div>
                    <button type="button" title="预览" onClick={() => openAttachment(a)} className="rounded p-1 text-muted-foreground hover:text-vault">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" title="下载" onClick={() => downloadAttachment(a)} className="rounded p-1 text-muted-foreground hover:text-vault">
                      <Download className="h-4 w-4" />
                    </button>
                    <button type="button" title="删除" onClick={() => removeAttachment(a)} className="rounded p-1 text-muted-foreground hover:text-destructive">
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
        <Button type="submit" disabled={submitting} className="gradient-accent-bg text-primary-foreground">
          {submitting ? "保存中…" : submitLabel}
        </Button>
      </div>

      <NewCategoryDialog open={showCatDialog} onOpenChange={setShowCatDialog} onCreated={handleCategoryCreated} />

      <Dialog open={!!previewAtt} onOpenChange={(o) => !o && setPreviewAtt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <span className="truncate">{previewAtt?.att.file_name}</span>
              {previewAtt && (
                <a
                  href={previewAtt.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-vault hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> 新标签
                </a>
              )}
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
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<{ key: string; label: string; type: FieldType }[]>([]);

  function addField() {
    if (fields.length >= MAX_CUSTOM_FIELDS) return toast.error(`最多 ${MAX_CUSTOM_FIELDS} 个自定义字段`);
    setFields((s) => [...s, { key: `f_${Date.now().toString(36)}_${s.length}`, label: "", type: "text" }]);
  }

  function save() {
    if (!label.trim()) return toast.error("请输入分类名");
    const cleaned = fields.filter((f) => f.label.trim());
    const key = addCustomCategory(label.trim(), cleaned);
    setLabel("");
    setFields([]);
    onCreated(key);
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
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例：车辆信息 / 保险单" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>自定义字段 <span className="text-xs text-muted-foreground">最多 {MAX_CUSTOM_FIELDS} 个，备注字段自动包含</span></Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="mr-1 h-3 w-3" /> 添加字段
              </Button>
            </div>
            {fields.map((f, i) => (
              <div key={f.key} className="flex items-center gap-2 rounded-md bg-surface-elevated p-2">
                <Input
                  placeholder={`字段名 ${i + 1}`}
                  value={f.label}
                  onChange={(e) => setFields((s) => s.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  className="h-8 flex-1"
                />
                <select
                  value={f.type}
                  onChange={(e) => setFields((s) => s.map((x, j) => j === i ? { ...x, type: e.target.value as FieldType } : x))}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                >
                  <option value="text">文本</option>
                  <option value="textarea">多行</option>
                  <option value="date">日期</option>
                </select>
                <button type="button" onClick={() => setFields((s) => s.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={save} className="gradient-accent-bg text-primary-foreground">保存分类</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentPreview({ att, url }: { att: ItemAttachment; url: string }) {
  const mime = att.mime_type ?? "";
  if (mime.startsWith("image/")) {
    return <img src={url} alt={att.file_name} className="max-h-[70vh] w-full rounded-md object-contain" />;
  }
  if (mime === "application/pdf") {
    return <iframe src={url} title={att.file_name} className="h-[70vh] w-full rounded-md bg-white" />;
  }
  if (mime.startsWith("video/")) {
    return <video src={url} controls className="max-h-[70vh] w-full rounded-md" />;
  }
  if (mime.startsWith("audio/")) {
    return <audio src={url} controls className="w-full" />;
  }
  if (mime.startsWith("text/")) {
    return <iframe src={url} title={att.file_name} className="h-[60vh] w-full rounded-md bg-white" />;
  }
  return (
    <div className="rounded-md bg-surface-elevated p-8 text-center text-sm text-muted-foreground">
      该文件类型无法直接预览，请点击下载查看。
    </div>
  );
}

function FileTypeIcon({ mime }: { mime: string | null }) {
  const m = mime ?? "";
  let label = "FILE";
  if (m.startsWith("image/")) label = "IMG";
  else if (m === "application/pdf") label = "PDF";
  else if (m.startsWith("video/")) label = "VID";
  else if (m.startsWith("audio/")) label = "AUD";
  else if (m.includes("word")) label = "DOC";
  else if (m.includes("sheet") || m.includes("excel")) label = "XLS";
  else if (m.includes("zip") || m.includes("compressed")) label = "ZIP";
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-vault/10 text-[10px] font-mono text-vault">
      {label}
    </span>
  );
}

// Removed unused import warning avoidance
export function _unused() { removeCustomCategory; }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
