import { useState, useEffect } from "react";
import { X, Plus, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAllCategories, saveCustomCategories, getCustomCategories, type Item } from "@/lib/vault";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type ItemFormValues = {
  name: string;
  category: string;
  tags: string[];
  account: string;
  password_hint: string;
  phone: string;
  email: string;
  notes: string;
};

export function itemToForm(item: Item): ItemFormValues {
  return {
    name: item.name,
    category: item.category,
    tags: item.tags ?? [],
    account: item.account ?? "",
    password_hint: item.password_hint ?? "",
    phone: item.phone ?? "",
    email: item.email ?? "",
    notes: item.notes ?? "",
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
  const [newCatInput, setNewCatInput] = useState("");
  const [cats, setCats] = useState(getAllCategories());
  const [attachments, setAttachments] = useState<{ id: string; file_name: string }[]>([]);

  useEffect(() => {
    if (!itemId) return;
    supabase.from("item_attachments").select("id,file_name").eq("item_id", itemId).then(({ data }) => {
      setAttachments(data ?? []);
    });
  }, [itemId]);

  function update<K extends keyof ItemFormValues>(k: K, v: ItemFormValues[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!values.tags.includes(t)) update("tags", [...values.tags, t]);
    setTagInput("");
  }

  function addCategory() {
    const label = newCatInput.trim();
    if (!label) return;
    const key = "custom_" + label.replace(/\s+/g, "_").toLowerCase() + "_" + Date.now().toString(36);
    const custom = getCustomCategories();
    const next = [...custom.map((c) => ({ key: c.key, label: c.label })), { key, label }];
    saveCustomCategories(next);
    setCats(getAllCategories());
    setNewCatInput("");
    update("category", key);
    toast.success("分类已添加");
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

    const ins = await supabase.from("item_attachments").insert({
      item_id: itemId,
      user_id: userData.user.id,
      file_name: file.name,
      file_path: path,
      size: file.size,
      mime_type: file.type,
    }).select("id,file_name").single();

    if (ins.error) return toast.error(ins.error.message);
    if (ins.data) setAttachments((a) => [...a, ins.data as { id: string; file_name: string }]);
    toast.success("附件已上传");
    e.target.value = "";
  }

  async function removeAttachment(id: string) {
    const row = attachments.find((a) => a.id === id);
    if (!row) return;
    // fetch full path
    const { data } = await supabase.from("item_attachments").select("file_path").eq("id", id).single();
    if (data?.file_path) await supabase.storage.from("vault-attachments").remove([data.file_path]);
    await supabase.from("item_attachments").delete().eq("id", id);
    setAttachments((a) => a.filter((x) => x.id !== id));
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
                <button
                  key={c.key}
                  type="button"
                  onClick={() => update("category", c.key)}
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
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="新增自定义分类…"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                className="h-8 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={addCategory}>添加</Button>
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
                placeholder="例如 常用 / 高权限"
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
              <Button type="button" size="sm" variant="outline" onClick={addTag}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-6 space-y-4">
        <h3 className="text-lg font-semibold">详细字段</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account">账号 / 用户名</Label>
            <Input id="account" value={values.account} onChange={(e) => update("account", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hint">
              密码提示词
              <span className="ml-2 text-xs text-muted-foreground">仅存提示词，不存明文</span>
            </Label>
            <Input
              id="hint"
              value={values.password_hint}
              onChange={(e) => update("password_hint", e.target.value)}
              placeholder="例：常用组合 + 生日后 4 位"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">绑定手机号</Label>
            <Input id="phone" value={values.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">绑定邮箱</Label>
            <Input id="email" type="email" value={values.email} onChange={(e) => update("email", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">备注</Label>
          <Textarea id="notes" rows={4} value={values.notes} onChange={(e) => update("notes", e.target.value)} />
        </div>
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
              <span className="text-xs text-muted-foreground">单个 ≤ 10MB</span>
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded bg-surface-elevated px-3 py-1.5 text-sm">
                    <span className="truncate">{a.file_name}</span>
                    <button type="button" onClick={() => removeAttachment(a.id)} className="text-muted-foreground hover:text-destructive">
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
    </form>
  );
}
