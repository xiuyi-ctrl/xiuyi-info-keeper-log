import { KeyRound, Flag, FileText, Folder } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FieldType = "text" | "textarea" | "date" | "email" | "tel";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** Optional column mapping on the items table. If absent, stored in extra JSONB. */
  column?: "account" | "password_hint" | "phone" | "email" | "notes";
  hint?: string;
  masked?: boolean;
};

export type CategorySchema = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  fields: FieldDef[];
  builtin?: boolean;
};

const ACCOUNT_FIELDS: FieldDef[] = [
  { key: "account", label: "账号 / 用户名", type: "text", column: "account" },
  { key: "password_hint", label: "密码提示词", type: "text", column: "password_hint", hint: "非明文，仅提示", masked: true },
  { key: "phone", label: "绑定手机号", type: "tel", column: "phone" },
  { key: "email", label: "绑定邮箱", type: "email", column: "email" },
  { key: "notes", label: "备注", type: "textarea", column: "notes" },
];

const PARTY_FIELDS: FieldDef[] = [
  { key: "time", label: "时间", type: "date" },
  { key: "introducer", label: "介绍人", type: "text" },
  { key: "number", label: "编号", type: "text" },
  { key: "notes", label: "备注", type: "textarea", column: "notes" },
];

const OTHER_FIELDS: FieldDef[] = [
  { key: "notes", label: "备注", type: "textarea", column: "notes" },
];

export const PRESET_CATEGORIES: CategorySchema[] = [
  { key: "account", label: "账号密码", icon: KeyRound, color: "oklch(0.78 0.14 185)", fields: ACCOUNT_FIELDS, builtin: true },
  { key: "party", label: "入党入团", icon: Flag, color: "oklch(0.72 0.19 340)", fields: PARTY_FIELDS, builtin: true },
  { key: "other", label: "其他", icon: FileText, color: "oklch(0.70 0.02 250)", fields: OTHER_FIELDS, builtin: true },
];

export const DEFAULT_TAGS = ["常用", "重要"];
export const MAX_CUSTOM_FIELDS = 4;

export const CUSTOM_CATEGORIES_KEY = "vault:custom_categories_v2";

type StoredCustomCategory = {
  key: string;
  label: string;
  extraFields: { key: string; label: string; type: FieldType }[]; // 备注 field is always appended automatically
};

function readStoredCustom(): StoredCustomCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredCustomCategory[];
  } catch {
    return [];
  }
}

function writeStoredCustom(list: StoredCustomCategory[]) {
  window.localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(list));
}

export function getCustomCategories(): CategorySchema[] {
  return readStoredCustom().map((c) => ({
    key: c.key,
    label: c.label,
    icon: Folder,
    color: "oklch(0.72 0.10 220)",
    fields: [
      ...c.extraFields.map<FieldDef>((f) => ({ key: f.key, label: f.label, type: f.type })),
      { key: "notes", label: "备注", type: "textarea", column: "notes" },
    ],
    builtin: false,
  }));
}

export function addCustomCategory(label: string, extraFields: { key: string; label: string; type: FieldType }[]): string {
  const cleaned = extraFields.filter((f) => f.label.trim()).slice(0, MAX_CUSTOM_FIELDS);
  const key = "custom_" + label.trim().replace(/\s+/g, "_").toLowerCase() + "_" + Date.now().toString(36);
  const list = readStoredCustom();
  list.push({ key, label: label.trim(), extraFields: cleaned });
  writeStoredCustom(list);
  return key;
}

export function removeCustomCategory(key: string) {
  writeStoredCustom(readStoredCustom().filter((c) => c.key !== key));
}

export function getAllCategories(): CategorySchema[] {
  return [...PRESET_CATEGORIES, ...getCustomCategories()];
}

export function getCategory(key: string): CategorySchema {
  return getAllCategories().find((c) => c.key === key) ?? PRESET_CATEGORIES[PRESET_CATEGORIES.length - 1];
}

export type ItemAttachment = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size: number;
};

export type Item = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  tags: string[];
  account: string | null;
  password_hint: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  extra: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SnapshotWithAttachments = Item & { attachments?: ItemAttachment[] };

export type HistoryEntry = {
  id: string;
  item_id: string;
  action: "create" | "update" | "delete" | "restore";
  snapshot: SnapshotWithAttachments;
  changed_at: string;
};

export const TRASH_RETENTION_DAYS = 7;

export function daysRemainingInTrash(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const purgeAt = deleted + TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
  const diff = purgeAt - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 3600 * 1000)));
}

export function maskValue(v: string | null | undefined): string {
  if (!v) return "";
  if (v.length <= 2) return "•".repeat(v.length);
  return v.slice(0, 1) + "•".repeat(Math.max(4, v.length - 2)) + v.slice(-1);
}

/** Read a field value from an item using its FieldDef mapping. */
export function readField(item: SnapshotWithAttachments, f: FieldDef): string {
  if (f.column) {
    const v = item[f.column];
    return v == null ? "" : String(v);
  }
  const v = (item.extra ?? {})[f.key];
  return v == null ? "" : String(v);
}

export function attachmentDiff(prev: ItemAttachment[] | undefined, curr: ItemAttachment[] | undefined) {
  const p = prev ?? [];
  const c = curr ?? [];
  const pIds = new Set(p.map((a) => a.id));
  const cIds = new Set(c.map((a) => a.id));
  const added = c.filter((a) => !pIds.has(a.id));
  const removed = p.filter((a) => !cIds.has(a.id));
  return { added, removed };
}

export function diffSnapshots(prev: SnapshotWithAttachments | null, curr: SnapshotWithAttachments): Set<string> {
  const changed = new Set<string>();
  if (!prev) return changed;
  const keys: (keyof Item)[] = ["name", "category", "tags", "account", "password_hint", "phone", "email", "notes", "deleted_at", "extra"];
  for (const k of keys) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(curr[k])) changed.add(k as string);
  }
  const { added, removed } = attachmentDiff(prev.attachments, curr.attachments);
  if (added.length || removed.length) changed.add("attachments");
  return changed;
}

export const FIELD_LABELS: Record<string, string> = {
  name: "名称",
  category: "分类",
  tags: "标签",
  account: "账号 / 用户名",
  password_hint: "密码提示词",
  phone: "绑定手机号",
  email: "绑定邮箱",
  notes: "备注",
  extra: "自定义字段",
  attachments: "附件",
  deleted_at: "删除状态",
};
