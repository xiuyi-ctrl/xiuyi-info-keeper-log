import { KeyRound, IdCard, CreditCard, Briefcase, GraduationCap, MessageCircle, FileText, Folder } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Category = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
};

export const PRESET_CATEGORIES: Category[] = [
  { key: "account", label: "账号密码", icon: KeyRound, color: "oklch(0.78 0.14 185)" },
  { key: "id", label: "个人证件", icon: IdCard, color: "oklch(0.72 0.18 60)" },
  { key: "bank", label: "银行卡 / 金融", icon: CreditCard, color: "oklch(0.75 0.16 145)" },
  { key: "work", label: "工作履历", icon: Briefcase, color: "oklch(0.68 0.18 265)" },
  { key: "edu", label: "教育 / 入团入党", icon: GraduationCap, color: "oklch(0.72 0.19 340)" },
  { key: "social", label: "社交账号", icon: MessageCircle, color: "oklch(0.80 0.13 220)" },
  { key: "other", label: "其他备注", icon: FileText, color: "oklch(0.70 0.02 250)" },
];

export const CUSTOM_CATEGORIES_KEY = "vault:custom_categories";

export function getCustomCategories(): Category[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as { key: string; label: string }[];
    return list.map((c) => ({ ...c, icon: Folder, color: "oklch(0.70 0.05 220)" }));
  } catch {
    return [];
  }
}

export function saveCustomCategories(cats: { key: string; label: string }[]) {
  window.localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(cats));
}

export function getAllCategories(): Category[] {
  return [...PRESET_CATEGORIES, ...getCustomCategories()];
}

export function getCategory(key: string): Category {
  return getAllCategories().find((c) => c.key === key) ?? PRESET_CATEGORIES[PRESET_CATEGORIES.length - 1];
}

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

export type HistoryEntry = {
  id: string;
  item_id: string;
  action: "create" | "update" | "delete" | "restore";
  snapshot: Item;
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

export function diffSnapshots(prev: Item | null, curr: Item): Set<string> {
  const changed = new Set<string>();
  if (!prev) return changed;
  const keys: (keyof Item)[] = ["name", "category", "tags", "account", "password_hint", "phone", "email", "notes", "deleted_at"];
  for (const k of keys) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(curr[k])) changed.add(k as string);
  }
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
  deleted_at: "删除状态",
};
